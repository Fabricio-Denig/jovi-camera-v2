/**
 * Product-level camera state: which mode is active, which panel is open, and
 * which tab the shell is showing.
 *
 * Deliberately separate from `useCamera`, which owns the MediaStream. Keeping
 * hardware state and product state apart is what lets panels, modes and tabs
 * change freely without ever re-acquiring the camera.
 */

export type ShellTab = "modes" | "camera" | "gallery";
export type SheetId = "modes" | "filters" | "settings";

export interface CameraState {
  modeId: string;
  tab: ShellTab;
  openSheet: SheetId | null;
}

export type CameraAction =
  | { type: "select-mode"; modeId: string }
  | { type: "open-sheet"; sheet: SheetId }
  | { type: "close-sheet" }
  | { type: "select-tab"; tab: ShellTab };

export const initialCameraState: CameraState = {
  modeId: "photo",
  tab: "camera",
  openSheet: null,
};

export function cameraReducer(
  state: CameraState,
  action: CameraAction,
): CameraState {
  switch (action.type) {
    case "select-mode":
      // Picking a mode always returns focus to the viewfinder: choosing from
      // the catalog and staying inside the panel would hide the very change
      // the user just made.
      return { ...state, modeId: action.modeId, openSheet: null, tab: "camera" };

    case "open-sheet":
      return { ...state, openSheet: action.sheet, tab: "camera" };

    case "close-sheet":
      return { ...state, openSheet: null };

    case "select-tab":
      // The "modes" tab is a panel over the camera, not a destination of its own.
      if (action.tab === "modes") {
        return { ...state, tab: "camera", openSheet: "modes" };
      }
      return { ...state, tab: action.tab, openSheet: null };

    default:
      return state;
  }
}
