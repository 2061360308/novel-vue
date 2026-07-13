export interface NovelMetadata {
  version: number;
  guri: string;
  title: string;
  author: string;
  cover: string | null;
  language: string;
  totalChapters: number;
  totalParts: number;
  createdAt: string;
  sourceFormat: string;
}

export interface TocEntry {
  id: string;
  title: string;
  level: number;
}

export interface QueuedFile {
  key: string;
  size: number;
  uploaded: string;
}

export interface UploadResult {
  status: 'processing' | 'queued';
  hash: string;
  message: string;
}

export type NovelCheck = {
  exists: true;
  guri: string;
  tags: string[];
  releaseUrl: string;
} | {
  exists: false;
};

export interface QueueInfo {
  files: QueuedFile[];
  actionRunning: boolean;
}
