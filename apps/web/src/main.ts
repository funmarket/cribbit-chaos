/*
 * Cribbit CHAOS Web-only presentation.
 *
 * Important:
 * - No body-level homepage scope hacks.
 * - No game-layout overrides.
 * - Homepage header behavior is scoped through
 *   .app-header.web-lobby-header.
 * - Homepage hero uses cc-web-* only.
 * - Telegram is untouched.
 */

/* =========================================================
   HOMEPAGE HEADER
   ========================================================= */

/*
 * Only applied while main.ts has confirmed
 * the lobby is actually visible.
 */

.app-header.web-lobby-header
.app-header__inner {
  display: grid;

  grid-template-columns:
    auto minmax(0, 1fr);

  grid-template-areas:
    "brand nav"
    "status tools";

  align-items: center;

  gap: 8px 18px;

  padding-block: 9px;
}

.app-header.web-lobby-header
.brand-lockup {
  grid-area: brand;
}

.app-header.web-lobby-header
.product-nav {
  grid-area: nav;

  justify-content: flex-start;

  min-width: 0;

  margin-left: 0;
}

.app-header.web-lobby-header
.status-cluster {
  grid-area: status;

  min-width: 0;
}

.app-header.web-lobby-header
.header-tools {
  grid-area: tools;

  min-width: 0;

  justify-content: flex-end;
}

.app-header.web-lobby-header
.nav-button {
  padding: 8px 11px;

  font-size: 13px;
}

/* =========================================================
   HOMEPAGE SECONDARY HEADER HIDE
   ========================================================= */

/*
 * Primary nav remains.
 * Only status/tools disappear while scrolling down.
 */

.app-header.web-lobby-header.web-secondary-hidden
.status-cluster,
.app-header.web-lobby-header.web-secondary-hidden
.header-tools {
  display: none;
}

.app-header.web-lobby-header.web-secondary-hidden
.app-header__inner {
  grid-template-areas:
    "brand nav";

  grid-template-columns:
    auto minmax(0, 1fr);

  gap: 0 18px;
}

/* =========================================================
   HOMEPAGE STRUCTURE
   ========================================================= */

.lobby-grid {
  grid-template-columns:
    minmax(0, 1fr);

  gap: 18px;
}

.lobby-hero {
  min-height: 0;

  padding: 0;

  overflow: visible;

  border: 0;

  background: transparent;

  box-shadow: none;
}

/* =========================================================
   HERO SHELL
   ========================================================= */

.cc-web-hero {
  --cc-lime: #a3e635;
  --cc-pink: #f472b6;
  --cc-cyan: #22d3ee;
  --cc-purple: #a855f7;
  --cc-green: #22c55e;
  --cc-orange: #f97316;
  --cc-yellow: #facc15;

  --cc-surface: #0d0e16;
  --cc-muted: #64748b;

  position: relative;

  isolation: isolate;

  width: 100%;

  min-height: 570px;

  overflow: hidden;

  color: #e2e8f0;

  border:
    1px solid
    rgba(255,255,255,.06);

  border-radius: 24px;

  background:
    radial-gradient(
      circle at 82% 18%,
      rgba(168,85,247,.14),
      transparent 34%
    ),
    radial-gradient(
      circle at 94% 72%,
      rgba(249,115,22,.08),
      transparent 34%
    ),
    radial-gradient(
      circle at 20% 100%,
      rgba(163,230,53,.05),
      transparent 35%
    ),
    #0d0e16;

  box-shadow:
    0 0 0 1px
      rgba(163,230,53,.07),
    0 0 90px
      rgba(168,85,247,.12),
    inset 0 1px 0
      rgba(255,255,255,.04);
}

.cc-web-hero,
.cc-web-hero *,
.cc-web-hero *::before,
.cc-web-hero *::after {
  box-sizing: border-box;
}

/* =========================================================
   HERO CONTENT
   ========================================================= */

.cc-web-content {
  position: relative;

  z-index: 10;

  display: flex;

  flex-direction: column;

  width: min(620px, 56%);

  padding:
    clamp(30px, 3vw, 44px)
    clamp(28px, 3.6vw, 52px);
}

/* =========================================================
   EYEBROW
   ========================================================= */

.cc-web-eyebrow {
  display: flex;

  align-items: center;

  gap: 8px;

  margin-bottom: 14px;
}

.cc-web-eyebrow-dot {
  flex: 0 0 6px;

  width: 6px;

  height: 6px;

  border-radius: 50%;

  background:
    var(--cc-lime);

  box-shadow:
    0 0 8px
    var(--cc-lime);

  animation:
    ccWebHeroBlink
    2s
    ease-in-out
    infinite;
}

@keyframes ccWebHeroBlink {
  0%,
  100% {
    opacity: 1;

    transform:
      scale(1);
  }

  50% {
    opacity: .4;

    transform:
      scale(.7);
  }
}

.cc-web-eyebrow-text,
.cc-web-eyebrow-tag {
  font-size: 10px;

  font-weight: 800;

  letter-spacing: .18em;

  text-transform: uppercase;
}

.cc-web-eyebrow-text {
  color:
    var(--cc-lime);
}

.cc-web-eyebrow-tag {
  color:
    var(--cc-muted);
}

.cc-web-eyebrow-sep {
  width: 28px;

  height: 1px;

  background:
    linear-gradient(
      90deg,
      var(--cc-lime),
      transparent
    );
}

/* =========================================================
   LOGO
   ========================================================= */

.cc-web-logo {
  display: flex;

  align-items: flex-start;

  gap: 14px;

  margin-bottom: 10px;
}

.cc-web-logo-frog {
  margin-top: 2px;

  font-size:
    clamp(
      42px,
      4vw,
      58px
    );

  line-height: 1;

  filter:
    drop-shadow(
      0 0 18px
      rgba(163,230,53,.45)
    );
}

.cc-web-logo-text {
  display: flex;

  flex-direction: column;

  line-height: .88;
}

.cc-web-logo-cribbit {
  color:
    var(--cc-lime);

  font-family:
    var(--font-display);

  font-size:
    clamp(
      34px,
      3.3vw,
      46px
    );

  font-weight: 950;

  letter-spacing: -.03em;

  text-shadow:
    0 0 28px
    rgba(163,230,53,.38);
}

.cc-web-logo-chaos {
  margin-top: 3px;

  color:
    var(--cc-pink);

  font-family:
    var(--font-display);

  font-size:
    clamp(
      31px,
      3vw,
      42px
    );

  font-style: italic;

  font-weight: 950;

  letter-spacing: .08em;

  text-shadow:
    0 0 28px
    rgba(244,114,182,.45);
}

/* =========================================================
   HEADLINE
   ========================================================= */

.cc-web-headline {
  margin:
    0 0 18px;

  color: #fff;

  font-family:
    var(--font-display);

  font-size:
    clamp(
      42px,
      4.4vw,
      62px
    );

  font-weight: 950;

  line-height: .91;

  letter-spacing: -.04em;

  text-transform: uppercase;
}

.cc-web-headline em {
  color:
    var(--cc-cyan);

  font-style: italic;

  text-shadow:
    0 0 24px
    rgba(34,211,238,.25);
}

.cc-web-headline span {
  color:
    var(--cc-pink);

  text-shadow:
    0 0 22px
    rgba(244,114,182,.35);
}

/* =========================================================
   STATS
   ========================================================= */

.cc-web-stats {
  display: grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0,1fr)
    );

  margin-bottom: 18px;

  overflow: hidden;

  border:
    1px solid
    rgba(255,255,255,.07);

  border-radius: 12px;

  background:
    rgba(255,255,255,.025);
}

.cc-web-stat {
  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 3px;

  min-width: 0;

  padding: 11px 8px;

  border-right:
    1px solid
    rgba(255,255,255,.07);
}

.cc-web-stat:last-child {
  border-right: none;
}

.cc-web-stat strong {
  font-family:
    var(--font-display);

  font-size: 18px;

  font-weight: 950;

  line-height: 1;
}

.cc-web-stat span {
  color:
    var(--cc-muted);

  font-size: 8px;

  font-weight: 800;

  letter-spacing: .13em;

  text-transform: uppercase;
}

.cc-web-stat--players
strong {
  color:
    var(--cc-lime);
}

.cc-web-stat--minutes
strong {
  color:
    var(--cc-cyan);
}

.cc-web-stat--cards
strong {
  color:
    var(--cc-pink);
}

.cc-web-stat--stories
strong {
  color:
    var(--cc-yellow);
}

/* =========================================================
   DESCRIPTION
   ========================================================= */

.cc-web-description {
  max-width: 510px;

  margin:
    0 0 18px;

  padding-left: 14px;

  color: #7a8fa8;

  border-left:
    2px solid
    rgba(163,230,53,.28);

  font-size: 15px;

  line-height: 1.48;
}

.cc-web-description strong {
  color: #d9e5f3;

  font-weight: 800;
}

/* =========================================================
   MECHANICS
   ========================================================= */

.cc-web-mechanics {
  display: flex;

  flex-wrap: wrap;

  gap: 6px;

  margin-bottom: 17px;
}

.cc-web-pill {
  display: inline-flex;

  align-items: center;

  min-height: 27px;

  padding: 5px 9px;

  border:
    1px solid;

  border-radius: 7px;

  font-size: 10px;

  font-weight: 850;

  letter-spacing: .04em;

  text-transform: uppercase;

  white-space: nowrap;
}

.cc-web-pill--truth {
  color: #4ade80;

  border-color:
    rgba(34,197,94,.32);

  background:
    rgba(34,197,94,.07);
}

.cc-web-pill--dare {
  color: #fb923c;

  border-color:
    rgba(249,115,22,.32);

  background:
    rgba(249,115,22,.07);
}

.cc-web-pill--paranoia {
  color: #c084fc;

  border-color:
    rgba(168,85,247,.32);

  background:
    rgba(168,85,247,.07);
}

.cc-web-pill--chaos {
  color: #f472b6;

  border-color:
    rgba(244,114,182,.32);

  background:
    rgba(244,114,182,.07);
}

.cc-web-pill--duel {
  color: #67e8f9;

  border-color:
    rgba(34,211,238,.32);

  background:
    rgba(34,211,238,.07);
}

.cc-web-pill--nope {
  color: #facc15;

  border-color:
    rgba(234,179,8,.32);

  background:
    rgba(234,179,8,.07);
}

/* =========================================================
   SAFETY BAR
   ========================================================= */

.cc-web-infobar {
  display: flex;

  align-items: flex-start;

  gap: 10px;

  margin-bottom: 19px;

  padding: 10px 13px;

  border:
    1px solid
    rgba(255,255,255,.07);

  border-radius: 10px;

  background:
    rgba(255,255,255,.025);
}

.cc-web-infobar-shield {
  flex-shrink: 0;

  font-size: 17px;

  filter:
    drop-shadow(
      0 0 6px
      rgba(168,85,247,.45)
    );
}

.cc-web-infobar p {
  margin: 0;

  color: #64748b;

  font-size: 10px;

  line-height: 1.45;
}

.cc-web-infobar strong {
  color: #94a3b8;
}

/* =========================================================
   HERO BUTTONS
   ========================================================= */

.cc-web-actions {
  display: flex;

  gap: 10px;

  width:
    min(
      520px,
      100%
    );
}

.cc-web-actions .button {
  flex: 1 1 0;

  display: inline-flex;

  align-items: center;

  justify-content: center;

  width: auto;

  min-width: 0;

  min-height: 46px;

  padding: 10px 17px;

  border-radius:
    12px 4px
    12px 4px;

  font-size: 11px;

  font-weight: 900;

  text-decoration: none;

  text-transform: uppercase;

  transition:
    transform .18s ease,
    border-color .18s ease,
    box-shadow .18s ease;
}

.cc-web-create {
  color: #ecffd0;

  border:
    1px solid
    rgba(163,230,53,.45);

  background:
    linear-gradient(
      135deg,
      rgba(163,230,53,.16),
      rgba(163,230,53,.02)
    ),
    #090d0a;
}

.cc-web-actions
#startGameButton {
  color: #fff;

  border-color:
    rgba(244,114,182,.48);

  background:
    linear-gradient(
      135deg,
      rgba(244,114,182,.16),
      rgba(249,115,22,.04)
    ),
    #0d0910;
}

.cc-web-actions
.button:hover,
.cc-web-actions
.button:focus-visible {
  transform:
    translateY(-2px);
}

/* =========================================================
   DECORATIVE HERO CARDS
   Homepage artwork only.
   ========================================================= */

.cc-web-cards-bg {
  position: absolute;

  inset:
    0 0 0 auto;

  width: 52%;

  height: 100%;

  overflow: hidden;

  pointer-events: none;

  -webkit-mask-image:
    linear-gradient(
      90deg,
      transparent 0%,
      black 20%
    );

  mask-image:
    linear-gradient(
      90deg,
      transparent 0%,
      black 20%
    );
}

.cc-web-game-card {
  position: absolute;

  display: flex;

  flex-direction: column;

  align-items: center;

  width: 160px;

  height: 242px;

  padding:
    18px 12px 10px;

  color: #fff;

  text-align: center;

  border:
    2px solid
    currentColor;

  border-radius: 15px;

  background:
    radial-gradient(
      circle at 50% 30%,
      color-mix(
        in srgb,
        currentColor 10%,
        transparent
      ),
      transparent 40%
    ),
    #05050a;

  box-shadow:
    0 0 28px
    color-mix(
      in srgb,
      currentColor 28%,
      transparent
    );
}

.cc-web-icon-wrap {
  display: flex;

  align-items: center;

  justify-content: center;

  width: 52px;

  height: 52px;

  margin-bottom: 13px;

  border:
    2px solid
    currentColor;

  border-radius: 50%;

  font-size: 24px;
}

.cc-web-card-title {
  margin-bottom: 9px;

  font-family:
    var(--font-display);

  font-size: 19px;

  font-weight: 950;

  letter-spacing: .04em;
}

.cc-web-divider {
  width: 38px;

  height: 1px;

  margin-bottom: 9px;

  background:
    currentColor;

  opacity: .5;
}

.cc-web-desc {
  color: #e2e8f0;

  font-size: 10px;

  line-height: 1.4;
}

.cc-web-flavor {
  margin-top: auto;

  color: #77869a;

  font-size: 8px;

  line-height: 1.35;
}

.cc-web-card-frog {
  margin-top: 8px;

  font-size: 13px;
}

.cc-web-card-truth {
  top: 30px;

  right: 220px;

  color: #4ade80;

  transform:
    rotate(-12deg);
}

.cc-web-card-dare {
  top: 55px;

  right: 45px;

  color: #fb923c;

  transform:
    rotate(10deg);
}

.cc-web-card-duel {
  top: 245px;

  right: 245px;

  color: #67e8f9;

  transform:
    rotate(12deg);
}

.cc-web-card-nope {
  top: 275px;

  right: 60px;

  color: #facc15;

  transform:
    rotate(-8deg);
}

/* =========================================================
   ROOM CREATION MODES
   Homepage/lobby component only.
   ========================================================= */

.setup-panel
.mode-grid {
  display: grid;

  grid-template-columns:
    repeat(
      4,
      minmax(0,1fr)
    ) !important;

  gap: 8px;
}

.setup-panel
.mode-card {
  display: grid;

  grid-template-rows:
    auto auto auto;

  align-content: center;

  gap: 4px;

  min-width: 0;

  min-height: 88px;

  padding: 10px 12px;
}

.setup-panel
.mode-card b {
  font-size: 16px;

  line-height: 1;
}

.setup-panel
.mode-card span {
  font-size: 9px;

  line-height: 1.18;
}

.setup-panel
.mode-card small {
  font-size: 8px;

  line-height: 1;
}

/* =========================================================
   WILD COLOR PICKER
   Existing Web gameplay correction.
   Keep unchanged.
   ========================================================= */

.inline-wild-grid {
  gap: 4px;
}

.inline-color-choice {
  min-height: 36px;

  grid-template-columns:
    7px minmax(0,1fr);

  grid-template-rows:
    auto auto;

  column-gap: 5px;

  row-gap: 0;

  padding: 4px 5px;

  overflow: hidden;
}

.inline-color-choice i {
  grid-column: 1;

  grid-row:
    1 / span 2;

  align-self: center;

  width: 6px;

  height: 6px;

  box-shadow:
    0 0 7px
    color-mix(
      in srgb,
      var(--choice) 45%,
      transparent
    );
}

.inline-color-choice b {
  grid-column: 2;

  grid-row: 1;

  min-width: 0;

  font-size: 6px;

  line-height: .95;

  letter-spacing: -.015em;

  overflow-wrap: anywhere;
}

.inline-color-choice span {
  grid-column: 2;

  grid-row: 2;

  min-width: 0;

  margin-top: 1px;

  font-size: 4.5px;

  line-height: 1;

  white-space: nowrap;
}

/* =========================================================
   RESPONSIVE HOMEPAGE
   ========================================================= */

@media (max-width: 1100px) {

  .cc-web-content {
    width: 62%;
  }

  .cc-web-cards-bg {
    width: 48%;

    opacity: .65;
  }

}

@media (max-width: 900px) {

  .cc-web-content {
    width: 100%;

    max-width: 680px;

    padding:
      32px 24px;
  }

  .cc-web-cards-bg {
    width: 100%;

    opacity: .14;

    -webkit-mask-image: none;

    mask-image: none;
  }

  .cc-web-headline {
    font-size: 42px;
  }

}

@media (max-width: 820px) {

  .setup-panel
  .mode-grid {
    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      ) !important;
  }

}

@media (max-width: 620px) {

  .cc-web-hero {
    min-height: 0;

    border-radius: 16px;
  }

  .cc-web-content {
    padding:
      26px 18px;
  }

  .cc-web-stats {
    grid-template-columns:
      repeat(
        2,
        minmax(0,1fr)
      );
  }

  .cc-web-stat:nth-child(2) {
    border-right: none;
  }

  .cc-web-stat:nth-child(-n+2) {
    border-bottom:
      1px solid
      rgba(255,255,255,.07);
  }

  .cc-web-actions {
    flex-direction: column;
  }

  .cc-web-headline {
    font-size: 36px;
  }

}

/* =========================================================
   REDUCED MOTION
   ========================================================= */

@media (
  prefers-reduced-motion:
  reduce
) {

  .cc-web-eyebrow-dot {
    animation: none;
  }

  .cc-web-actions
  .button {
    transition: none;
  }

}
