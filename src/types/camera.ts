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
}
