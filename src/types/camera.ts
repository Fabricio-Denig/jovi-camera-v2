export type CameraFacing = "environment" | "user";

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unsupported"
  | "error";

export type CaptureKind = "photo" | "video";

export interface CapturedMedia {
  id: string;
  kind: CaptureKind;
  blob: Blob;
  mimeType: string;
  createdAt: number;
  width: number;
  height: number;
  /** Present when the capture came from a SliD session, which groups it by class. */
  session?: {
    id: string;
    subject: string;
    /** Milliseconds into the session, preserving the order of the class. */
    atMs: number;
  };
}
