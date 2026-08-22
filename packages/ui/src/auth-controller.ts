import type { AuthUser } from '../../contracts/src/index.ts';

export type FrontendAuthSource = 'TELEGRAM' | 'WEB';
export type FrontendAuthState =
  | { status:'LOADING'; user:null; source:null }
  | { status:'GUEST'; user:null; source:null }
  | { status:'AUTHENTICATED'; user:AuthUser; source:FrontendAuthSource };

type AuthListener = (state:FrontendAuthState) => void;

class CribbitAuthController {
  private state: FrontendAuthState = { status:'LOADING', user:null, source:null };
  private readonly listeners = new Set<AuthListener>();

  get current(): FrontendAuthState {
    return this.state;
  }

  loading(): void {
    this.publish({ status:'LOADING', user:null, source:null });
  }

  guest(): void {
    this.publish({ status:'GUEST', user:null, source:null });
  }

  authenticated(user:AuthUser, source:FrontendAuthSource): void {
    this.publish({ status:'AUTHENTICATED', user, source });
  }

  subscribe(listener:AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private publish(state:FrontendAuthState): void {
    this.state = state;
    this.listeners.forEach(listener => listener(state));
  }
}

export const cribbitAuth = new CribbitAuthController();
