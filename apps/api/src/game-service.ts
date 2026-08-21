import { randomBytes, randomUUID } from 'node:crypto';
import type { AuthUser, CommandResponse, GameCommand, GameEvent, GameState, SessionSnapshot } from '../../../packages/contracts/src/index.ts';
import { applyCommand, createGame } from '../../../packages/game-engine/src/index.ts';
import { promptPoolForSources } from '../../../packages/prompts/src/index.ts';
import { pool, withTransaction } from './db.ts';
import { advanceCanonicalBots, isBotPlayerId } from './canonical-bots.ts';

const BOT_NAMES=['Maya','Leo','Nina','Jordan','Sam','Alex','Zoe','Arjun','Dev'] as const;
const BOT_PREFIX='bot:';

export interface RoomCreateInput{roomName?:string;mode?:string;playerCount?:number;world?:'clean'|'adult';ceiling?:number;sources?:Record<string,boolean>;}
export interface SessionPlayerView{id:string;name:string;isHuman:boolean;}
export interface RoomSessionResult{ok:true;roomId:string;sessionId:string;joinCode:string;players:SessionPlayerView[];}
export interface ProjectedSessionSnapshot extends SessionSnapshot<GameState>{players:SessionPlayerView[];}
type StoredRoomConfig=RoomCreateInput&{playerNames?:Record<string,string>;};

function requirePool(){if(!pool)throw Object.assign(new Error('DATABASE_URL is not configured.'),{code:'DATABASE_UNAVAILABLE',statusCode:503});return pool;}
function normalizePlayerCount(value:unknown):number{const count=Number(value??5);if(!Number.isInteger(count)||count<2||count>10)throw Object.assign(new Error('playerCount must be between 2 and 10.'),{code:'INVALID_PLAYER_COUNT',statusCode:400});return count;}
function normalizeRoomName(value:unknown):string{const roomName=String(value??'Night Squad').trim();if(!roomName||roomName.length>40)throw Object.assign(new Error('roomName must be 1 to 40 characters.'),{code:'INVALID_ROOM_NAME',statusCode:400});return roomName;}
function makeJoinCode():string{return randomBytes(6).toString('base64url').replace(/[^A-Za-z0-9]/g,'').slice(0,8).toUpperCase();}
function botId(sessionId:string,index:number):string{return`${BOT_PREFIX}${sessionId}:${index}`;}

function playerViewsFromState(state:GameState,config:StoredRoomConfig,viewerId:string):SessionPlayerView[]{const names=config.playerNames??{};return state.players.map((p,index)=>({id:p.id,name:names[p.id]??(isBotPlayerId(p.id)?BOT_NAMES[Math.max(0,index-1)]??`Player ${index+1}`:p.id),isHuman:p.id===viewerId}));}

function redactCanonicalSocial(state:GameState,viewerId:string):void{
  const social=state.social;if(!social?.canonicalStep)return;
  const actor=social.actorId;const target=social.pendingTargetId;const duel=social.pendingDuel;
  const isDuelParticipant=Boolean(duel&&[duel.initiatorId,duel.opponentId].includes(viewerId));
  const maySeePrompt=social.canonicalStep==='PRIVATE_PREVIEW'?viewerId===actor:
    social.cardKind==='paranoia'?viewerId===actor:
    social.cardKind==='duel'?isDuelParticipant||social.canonicalStep==='DUEL_VOTE':
    social.cardKind==='truth'||social.cardKind==='dare'?[actor,target].filter(Boolean).includes(viewerId):true;
  if(!maySeePrompt){social.prompt=null;social.promptSelection=null;social.roulettePresentation=null;social.manualPrompt=null;}
  if(social.cardKind==='truth_or_chaos'&&social.canonicalStep==='GROUP_ANSWER'){
    const own=social.groupAnswers?.[viewerId];social.groupAnswers=own?{[viewerId]:own}:{};
  }
  if(social.cardKind==='taboo'&&![actor,target].includes(viewerId))social.question=null;
  if((social.cardKind==='reverse_confession'||social.cardKind==='dig_me')&&![actor,target].includes(viewerId))social.question=null;
}

function projectStateForPlayer(state:GameState,viewerId:string):GameState{
  const projected=structuredClone(state);
  projected.players=projected.players.map(p=>p.id===viewerId?p:{...p,hand:p.hand.map((_,index)=>({id:`hidden:${p.id}:${index}`,kind:'number' as const})),ghostArmedCard:p.ghostArmedCard?{id:`hidden-ghost:${p.id}`,kind:'ghost' as const}:null});
  projected.processedCommands={};redactCanonicalSocial(projected,viewerId);return projected;
}
function visibleEvents(events:readonly GameEvent[],viewerId:string):GameEvent[]{return events.filter(event=>event.visibility!=='PLAYER_PRIVATE'||!event.recipientPlayerIds?.length||event.recipientPlayerIds.includes(viewerId));}
async function persistEvents(client:any,sessionId:string,events:readonly GameEvent[]):Promise<void>{for(const event of events){await client.query(`insert into game_events(session_id,revision,event_type,payload) values($1,$2,$3,$4::jsonb)`,[sessionId,event.revision,event.type,JSON.stringify(event.payload??{})]);}}

function engineContext(config?:StoredRoomConfig,now=Date.now()){return{canonicalFlow:true,now,promptPool:promptPoolForSources(config?.sources),promptProfile:{stage:Number.MAX_SAFE_INTEGER,intensity:Number.isFinite(Number(config?.ceiling))?Number(config?.ceiling):Number.MAX_SAFE_INTEGER,language:'*',callSuitability:'*'}};}

export async function createRoomAndSession(user:AuthUser,input:RoomCreateInput):Promise<RoomSessionResult>{
  const playerCount=normalizePlayerCount(input.playerCount),roomName=normalizeRoomName(input.roomName),world=input.world==='adult'?'adult':'clean',sessionId=randomUUID(),joinCode=makeJoinCode();
  const bots=Array.from({length:playerCount-1},(_,index)=>({id:botId(sessionId,index+1),seat:index+1}));
  const playerNames:Record<string,string>={[user.id]:user.displayName};bots.forEach((bot,index)=>{playerNames[bot.id]=BOT_NAMES[index]??`Player ${index+2}`;});
  const config:StoredRoomConfig={...input,roomName,playerCount,world,playerNames};
  const created=createGame({seed:sessionId,startingHandCount:7,startingPlayerIndex:0,allowVoluntaryDraw:true,contentWorld:world==='adult'?'18+_ADULT':'UNDER_18_CLEAN'},[{id:user.id,seat:0},...bots],undefined,{now:Date.now()});
  if(!created.ok)throw Object.assign(new Error(created.error?.message??'Unable to create game.'),{code:created.error?.code??'INVALID_SETUP',statusCode:400});
  created.state.id=sessionId;created.state.forcedQueue=[];created.state.bonusTurnStack=[];created.events.forEach(event=>{event.sessionId=sessionId;});
  const roomId=await withTransaction(async client=>{const room=await client.query(`insert into rooms(join_code,owner_user_id,config) values($1,$2,$3::jsonb) returning id`,[joinCode,user.id,JSON.stringify(config)]);const id=String(room.rows[0].id);await client.query(`insert into room_members(room_id,user_id,role) values($1,$2,'owner') on conflict(room_id,user_id) do nothing`,[id,user.id]);await client.query(`insert into game_sessions(id,room_id,status,revision,state) values($1,$2,$3,$4,$5::jsonb)`,[sessionId,id,created.state.status,created.state.revision,JSON.stringify(created.state)]);await persistEvents(client,sessionId,created.events);return id;});
  return{ok:true,roomId,sessionId,joinCode,players:playerViewsFromState(created.state,config,user.id)};
}

export async function joinRoomByCode(user:AuthUser,code:string):Promise<RoomSessionResult>{
  const db=requirePool(),normalized=code.trim().toUpperCase();const roomResult=await db.query(`select id,join_code,config from rooms where upper(join_code)=upper($1)`,[normalized]);if(!roomResult.rowCount)throw Object.assign(new Error('Room not found.'),{code:'ROOM_NOT_FOUND',statusCode:404});
  const roomId=String(roomResult.rows[0].id),config=(roomResult.rows[0].config??{}) as StoredRoomConfig;await db.query(`insert into room_members(room_id,user_id,role) values($1,$2,'player') on conflict(room_id,user_id) do nothing`,[roomId,user.id]);
  const sessionResult=await db.query(`select id,state,revision from game_sessions where room_id=$1 and status='ACTIVE' order by created_at desc limit 1`,[roomId]);if(!sessionResult.rowCount)throw Object.assign(new Error('Room has no active game yet.'),{code:'SESSION_NOT_STARTED',statusCode:409});
  const sessionId=String(sessionResult.rows[0].id),state=sessionResult.rows[0].state as GameState;
  if(!state.players.some(p=>p.id===user.id)){
    if(state.revision!==0)throw Object.assign(new Error('This game already started.'),{code:'GAME_ALREADY_STARTED',statusCode:409});
    const replacement=state.players.find(p=>isBotPlayerId(p.id));if(!replacement)throw Object.assign(new Error('Room is full.'),{code:'ROOM_FULL',statusCode:409});const oldId=replacement.id;replacement.id=user.id;if(state.currentPlayerId===oldId)state.currentPlayerId=user.id;config.playerNames={...(config.playerNames??{}),[user.id]:user.displayName};delete config.playerNames[oldId];await db.query(`update rooms set config=$2::jsonb where id=$1`,[roomId,JSON.stringify(config)]);await db.query(`update game_sessions set state=$2::jsonb,updated_at=now() where id=$1`,[sessionId,JSON.stringify(state)]);
  }
  return{ok:true,roomId,sessionId,joinCode:String(roomResult.rows[0].join_code),players:playerViewsFromState(state,config,user.id)};
}

async function loadSessionRow(sessionId:string,userId:string,forUpdate=false,client:any=requirePool()){
  const result=await client.query(`select gs.id,gs.state,gs.revision,gs.status,r.config from game_sessions gs join rooms r on r.id=gs.room_id join room_members rm on rm.room_id=r.id where gs.id=$1 and rm.user_id=$2${forUpdate?' for update of gs':''}`,[sessionId,userId]);if(!result.rowCount)throw Object.assign(new Error('Game session not found.'),{code:'SESSION_NOT_FOUND',statusCode:404});return result.rows[0] as{id:string;state:GameState;revision:number;status:string;config:StoredRoomConfig};
}

export async function getSessionSnapshot(user:AuthUser,sessionId:string):Promise<ProjectedSessionSnapshot>{const row=await loadSessionRow(sessionId,user.id);return{sessionId,revision:Number(row.revision),state:projectStateForPlayer(row.state,user.id),players:playerViewsFromState(row.state,row.config??{},user.id),serverTime:new Date().toISOString()};}

export async function processSessionCommand(user:AuthUser,sessionId:string,command:GameCommand):Promise<CommandResponse<GameState>>{
  if(command.sessionId!==sessionId)throw Object.assign(new Error('Command session does not match route.'),{code:'SESSION_MISMATCH',statusCode:400});if(command.playerId!==user.id)throw Object.assign(new Error('Command player does not match authenticated user.'),{code:'PLAYER_MISMATCH',statusCode:403});
  return withTransaction(async client=>{
    const duplicate=await client.query(`select result from game_commands where command_id=$1 and session_id=$2`,[command.commandId,sessionId]);if(duplicate.rowCount&&duplicate.rows[0].result)return duplicate.rows[0].result as CommandResponse<GameState>;
    const row=await loadSessionRow(sessionId,user.id,true,client),originalState=row.state;if(!originalState.players.some(p=>p.id===user.id))throw Object.assign(new Error('Authenticated user is not a player in this session.'),{code:'PLAYER_NOT_IN_SESSION',statusCode:403});
    const transition=applyCommand(originalState,command,engineContext(row.config,Date.now()));let finalState=transition.state,allEvents=[...transition.events];
    if(transition.ok){const bots=advanceCanonicalBots(finalState,row.config);finalState=bots.state;allEvents=[...allEvents,...bots.events];await client.query(`update game_sessions set status=$2,revision=$3,state=$4::jsonb,updated_at=now() where id=$1`,[sessionId,finalState.status,finalState.revision,JSON.stringify(finalState)]);await persistEvents(client,sessionId,allEvents);}
    const response:CommandResponse<GameState>={ok:transition.ok,commandId:command.commandId,revision:finalState.revision,state:projectStateForPlayer(finalState,user.id),events:visibleEvents(allEvents,user.id),...(transition.error?{error:{code:transition.error.code,message:transition.error.message}}:{}),...(transition.idempotentReplay?{idempotentReplay:true}:{})};
    await client.query(`insert into game_commands(command_id,session_id,actor_user_id,expected_revision,command_type,payload,result) values($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,[command.commandId,sessionId,user.id,command.expectedRevision,command.type,JSON.stringify(command),JSON.stringify(response)]);return response;
  });
}
