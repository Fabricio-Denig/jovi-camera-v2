import { useReducer, useState } from "react";
import { BottomNav } from "./BottomNav";
import { CameraShell } from "../camera/CameraShell";
import { GalleryPage } from "../gallery/GalleryPage";
import { ClassPage } from "../slid/ClassPage";
import { ModesSheet } from "../modes/ModesSheet";
import { cameraReducer, initialCameraState } from "../state/cameraState";

/**
 * Composes the product shell around the camera.
 *
 * The camera is mounted once and never unmounted. Other surfaces are drawn on
 * top of it instead of replacing it, so switching tabs or opening a panel costs
 * nothing: re-acquiring a MediaStream takes about a second, can fail, and is
 * precisely what produced the black-preview bug. Navigation is plain state for
 * the same reason — a router that swaps the camera out would undo that.
 */
export function AppShell() {
  const [state, dispatch] = useReducer(cameraReducer, initialCameraState);
  const [galleryRefresh, setGalleryRefresh] = useState(0);
  const [boardDetected, setBoardDetected] = useState(false);
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  /**
   * The review surfaces are documents, not tabs. Leaving the app's navigation
   * under a finished class makes it read as one more screen of a camera app,
   * when the whole point of that screen is that the class became something the
   * student keeps.
   */
  const [reviewOpen, setReviewOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <CameraShell
            modeId={state.modeId}
            onSelectMode={(modeId) => dispatch({ type: "select-mode", modeId })}
            onOpenModes={() => dispatch({ type: "open-sheet", sheet: "modes" })}
            onCaptureSaved={() => setGalleryRefresh((n) => n + 1)}
            onBoardDetected={setBoardDetected}
            onOpenClass={setOpenClassId}
            onOpenGallery={() => dispatch({ type: "select-tab", tab: "gallery" })}
            onReviewOpenChange={setReviewOpen}
          />
        </div>

        {/* Drawn over the live camera rather than replacing it. */}
        {state.tab === "gallery" && (
          <div className="absolute inset-0 z-30">
            <GalleryPage
              refreshKey={galleryRefresh}
              onOpenClass={setOpenClassId}
            />
          </div>
        )}

        {/* Drawn over the camera like every other surface: reopening a class
            must never cost a re-acquisition of the stream. */}
        {openClassId && (
          <div className="absolute inset-0 z-40">
            <ClassPage
              classId={openClassId}
              onClose={() => setOpenClassId(null)}
              onTrashed={() => setGalleryRefresh((n) => n + 1)}
            />
          </div>
        )}

        <ModesSheet
          open={state.openSheet === "modes"}
          activeModeId={state.modeId}
          suggestedModeId={boardDetected ? "slid" : null}
          onSelect={(modeId) => dispatch({ type: "select-mode", modeId })}
          onClose={() => dispatch({ type: "close-sheet" })}
        />
      </div>

      {!reviewOpen && openClassId === null && (
        <BottomNav
          tab={state.tab}
          sheetOpen={state.openSheet !== null}
          onSelect={(tab) => dispatch({ type: "select-tab", tab })}
        />
      )}
    </div>
  );
}
