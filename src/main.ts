import './style.css';
import { Game } from './core/Game';

const app = document.getElementById('app')!;
const ui = document.getElementById('ui')!;
const game = new Game(app, ui);
(window as unknown as { __fb: Game }).__fb = game; // handy for console debugging
game.start().catch((err: unknown) => {
  console.error(err);
  ui.innerHTML = `<div class="screen dim"><div class="panel"><h2>載入失敗</h2><p>${String(err)}</p></div></div>`;
});
