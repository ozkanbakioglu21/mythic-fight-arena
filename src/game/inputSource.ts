import { InputAction } from "./types";
import { InputManager } from "./InputManager";

/**
 * KeyboardInput — klavye girdisini InputManager'a bağlar.
 * Yön tuşları ve aksiyon tuşları ayrı ele alınır; aksiyonlar `press` ile
 * 6-frame tamponuna, yönler `setHeld` ile anlık eksen olarak iletilir.
 */
export class KeyboardInput {
  private keys = new Map<string, InputAction>();
  private held = new Set<InputAction>();
  private moveX = 0;
  private moveY = 0;
  private destroyFns: Array<() => void> = [];

  constructor(private manager: InputManager) {
    this.bind();
  }

  private bind(): void {
    const actions: [string, InputAction][] = [
      ["KeyJ", InputAction.LIGHT],
      ["KeyK", InputAction.HEAVY],
      ["KeyL", InputAction.SPECIAL],
      ["KeyI", InputAction.ULTIMATE],
      ["KeyG", InputAction.PARRY],
      ["Space", InputAction.DASH],
      ["ShiftLeft", InputAction.BLOCK],
      ["ShiftRight", InputAction.BLOCK],
      ["KeyW", InputAction.MOVE_UP],
      ["KeyS", InputAction.MOVE_DOWN],
      ["KeyA", InputAction.MOVE_LEFT],
      ["KeyD", InputAction.MOVE_RIGHT],
    ];
    for (const [code, action] of actions) this.keys.set(code, action);

    const onDown = (e: KeyboardEvent) => {
      const action = this.keys.get(e.code);
      if (!action) return;
      e.preventDefault();
      if (e.repeat) return;
      this.held.add(action);
      // Aksiyon tuşları buffer'a giriş yazar.
      if (
        action === InputAction.LIGHT ||
        action === InputAction.HEAVY ||
        action === InputAction.SPECIAL ||
        action === InputAction.ULTIMATE ||
        action === InputAction.PARRY
      ) {
        this.manager.press(action);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const action = this.keys.get(e.code);
      if (action) this.held.delete(action);
    };
    const onBlur = () => this.held.clear();

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    this.destroyFns.push(
      () => window.removeEventListener("keydown", onDown),
      () => window.removeEventListener("keyup", onUp),
      () => window.removeEventListener("blur", onBlur),
    );
  }

  /** Her frame başında yön vektörünü ve held setini InputManager'a iletir. */
  sync(): void {
    let x = 0;
    let y = 0;
    if (this.held.has(InputAction.MOVE_LEFT)) x -= 1;
    if (this.held.has(InputAction.MOVE_RIGHT)) x += 1;
    if (this.held.has(InputAction.MOVE_UP)) y -= 1;
    if (this.held.has(InputAction.MOVE_DOWN)) y += 1;
    this.moveX = x;
    this.moveY = y;
    this.manager.beginFrame();
    this.manager.setHeld(this.held, this.moveX, this.moveY);
  }

  dispose(): void {
    for (const fn of this.destroyFns) fn();
    this.destroyFns.length = 0;
  }
}
