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
  /** Marked by the student, and the only reason a capture ever gets promoted. */
  favorite?: boolean;
  /**
   * When it was thrown away. Set rather than deleted, so the trash can give it
   * back: a lecture is not something to lose to one stray tap.
   */
  deletedAt?: number;
  /** Present when the capture came from a SliD session, which groups it by class. */
  session?: {
    id: string;
    subject: string;
    /**
     * The matéria the student filed it under, when they said. Never guessed —
     * an invented subject is an invented class.
     */
    discipline?: string;
    /** Milliseconds into the session, preserving the order of the class. */
    atMs: number;
    /**
     * What the camera recognised, already in the student's language. Stored
     * because it is the result — reopening a class months later must not
     * depend on reading the board again, and the reading itself is never
     * persisted: a transcript is exactly what this product is not.
     */
    label?: string;
    detail?: string | null;
    /** The kind of content, in one word. */
    category?: string | null;
    /** How long the topic kept growing before it settled. */
    spanMs?: number;
    /*
     * Class-level facts, repeated on every moment. Denormalised on purpose: a
     * class is then one query and no second object store, and the subject was
     * already stored this way.
     */
    durationMs?: number;
    skippedDuplicates?: number;
    savedAt?: number;
    /** What the class was about, as lines the lecturer actually wrote. */
    topics?: string[];
    /** The class in a sentence, assembled from what was captured. */
    overview?: string;
    /** Structures the camera recognised, as [kind, count] — the class reopens saying what the summary said. */
    kinds?: [string, number][];
    /** Marked by the student. Denormalised across the moments, like the name. */
    favorite?: boolean;
  };
}
