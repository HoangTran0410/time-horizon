import type {
  SyncProjectionRemoteState,
  SyncProjectionSnapshot,
} from "./index";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type GoogleTokenClientConfig = {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponse) => void;
  error_callback?: (error: { type: string }) => void;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleAccountsNamespace = {
  oauth2: {
    initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
    revoke: (token: string, callback?: () => void) => void;
  };
};

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccountsNamespace;
    };
  }
}

type DriveFileResponse = {
  id: string;
  name: string;
  mimeType?: string;
  modifiedTime?: string;
  version?: string;
};

type DriveManifestCollectionRecord = {
  id: string;
  fileId: string;
  revision?: string;
  contentHash?: string;
};

type DriveManifestPayload = {
  generatedAt?: string;
  rootFolderId?: string;
  collectionsFolderId?: string;
  preferences?: SyncProjectionSnapshot["preferences"];
  collections?: DriveManifestCollectionRecord[];
  deletedCollections?: SyncProjectionSnapshot["deletedCollections"];
};

type DriveFilesListResponse = {
  files?: DriveFileResponse[];
};

const GOOGLE_GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/drive/v3/files";
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

let gisLoadPromise: Promise<void> | null = null;

const hashContent = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const escapeDriveQueryValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const getDriveErrorMessage = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return `Drive request failed with status ${response.status}.`;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: { message?: string };
    };
    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

const driveFetch = async <T>(
  accessToken: string,
  input: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(input, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await getDriveErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

const createMultipartBody = (metadata: Record<string, unknown>, content: string) => {
  const boundary = `time-horizon-${Math.random().toString(36).slice(2)}`;
  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return {
    body,
    contentType: `multipart/related; boundary=${boundary}`,
  };
};

const findDriveFileByName = async (options: {
  accessToken: string;
  name: string;
  mimeType?: string;
  parentId?: string;
}): Promise<DriveFileResponse | null> => {
  const params = new URLSearchParams({
    fields: "files(id,name,mimeType,modifiedTime,version)",
    pageSize: "1",
  });

  const queryParts = [
    `name = '${escapeDriveQueryValue(options.name)}'`,
    "trashed = false",
  ];

  if (options.mimeType) {
    queryParts.push(`mimeType = '${escapeDriveQueryValue(options.mimeType)}'`);
  }

  if (options.parentId) {
    queryParts.push(`'${escapeDriveQueryValue(options.parentId)}' in parents`);
  }

  params.set("q", queryParts.join(" and "));

  const response = await driveFetch<{ files?: DriveFileResponse[] }>(
    options.accessToken,
    `${DRIVE_FILES_ENDPOINT}?${params.toString()}`,
  );

  return response.files?.[0] ?? null;
};

const listDriveFiles = async (options: {
  accessToken: string;
  parentId: string;
  mimeType?: string;
}): Promise<DriveFileResponse[]> => {
  const params = new URLSearchParams({
    fields: "files(id,name,mimeType,modifiedTime,version)",
    pageSize: "1000",
  });

  const queryParts = [`'${escapeDriveQueryValue(options.parentId)}' in parents`, "trashed = false"];
  if (options.mimeType) {
    queryParts.push(`mimeType = '${escapeDriveQueryValue(options.mimeType)}'`);
  }
  params.set("q", queryParts.join(" and "));

  const response = await driveFetch<DriveFilesListResponse>(
    options.accessToken,
    `${DRIVE_FILES_ENDPOINT}?${params.toString()}`,
  );

  return response.files ?? [];
};

const createDriveFolder = async (options: {
  accessToken: string;
  name: string;
  parentId?: string;
}): Promise<DriveFileResponse> =>
  driveFetch<DriveFileResponse>(
    options.accessToken,
    `${DRIVE_FILES_ENDPOINT}?fields=id,name,mimeType,modifiedTime,version`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        name: options.name,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        ...(options.parentId ? { parents: [options.parentId] } : {}),
      }),
    },
  );

const upsertDriveJsonFile = async (options: {
  accessToken: string;
  folderId: string;
  fileName: string;
  existingFileId?: string;
  payload: unknown;
}): Promise<{
  fileId: string;
  revision?: string;
  contentHash: string;
}> => {
  const content = JSON.stringify(options.payload, null, 2);
  const existingFile = options.existingFileId
    ? {
        id: options.existingFileId,
        name: options.fileName,
      }
    : await findDriveFileByName({
        accessToken: options.accessToken,
        name: options.fileName,
        parentId: options.folderId,
      });

  if (existingFile) {
    const updated = await driveFetch<DriveFileResponse>(
      options.accessToken,
      `${DRIVE_UPLOAD_ENDPOINT}/${existingFile.id}?uploadType=media&fields=id,version`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: content,
      },
    );

    return {
      fileId: updated.id,
      revision: updated.version,
      contentHash: hashContent(content),
    };
  }

  const multipart = createMultipartBody(
    {
      name: options.fileName,
      parents: [options.folderId],
      mimeType: "application/json",
    },
    content,
  );

  const created = await driveFetch<DriveFileResponse>(
    options.accessToken,
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,version`,
    {
      method: "POST",
      headers: {
        "Content-Type": multipart.contentType,
      },
      body: multipart.body,
    },
  );

  return {
    fileId: created.id,
    revision: created.version,
    contentHash: hashContent(content),
  };
};

const readDriveJsonFile = async <T>(
  accessToken: string,
  fileId: string,
): Promise<T> =>
  driveFetch<T>(
    accessToken,
    `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`,
  );

const createDefaultRemotePreferences = (): SyncProjectionSnapshot["preferences"] => ({
  onboardingCompleted: true,
  enabledScopes: ["custom-collections", "catalog-metadata", "collection-colors"],
  autosyncEnabled: false,
  lastSuccessfulSyncAt: null,
});

const rebuildRemoteStateFromCollectionsFolder = async (options: {
  accessToken: string;
  rootFolderId: string;
  collectionsFolderId: string;
}): Promise<SyncProjectionRemoteState> => {
  const collectionFiles = await listDriveFiles({
    accessToken: options.accessToken,
    parentId: options.collectionsFolderId,
  });

  const collections = await Promise.all(
    collectionFiles
      .filter((file) => file.name.endsWith(".json"))
      .map(async (file) => {
        const remoteCollection = await readDriveJsonFile<
          SyncProjectionSnapshot["collections"][number]
        >(options.accessToken, file.id);

        return {
          ...remoteCollection,
          id: remoteCollection.id ?? file.name.replace(/\.json$/u, ""),
          fileId: file.id,
          revision: file.version,
          contentHash:
            remoteCollection.contentHash ??
            hashContent(JSON.stringify(remoteCollection, null, 2)),
        };
      }),
  );

  return {
    generatedAt: new Date().toISOString(),
    preferences: createDefaultRemotePreferences(),
    collections,
    deletedCollections: [],
    rootFolderId: options.rootFolderId,
    collectionsFolderId: options.collectionsFolderId,
  };
};

const writeManifestPayload = async (options: {
  accessToken: string;
  rootFolderId: string;
  existingManifestFileId?: string;
  payload: DriveManifestPayload;
}): Promise<{
  fileId: string;
}> => {
  const result = await upsertDriveJsonFile({
    accessToken: options.accessToken,
    folderId: options.rootFolderId,
    fileName: "manifest.json",
    existingFileId: options.existingManifestFileId,
    payload: options.payload,
  });

  return { fileId: result.fileId };
};

const loadRemoteStateWithRecovery = async (options: {
  accessToken: string;
  rootFolderName?: string;
}): Promise<{
  remoteState: SyncProjectionRemoteState | null;
  recoveredManifest: boolean;
}> => {
  const rootFolder = await findDriveFileByName({
    accessToken: options.accessToken,
    name: options.rootFolderName ?? "time-horizon",
    mimeType: DRIVE_FOLDER_MIME_TYPE,
  });

  if (!rootFolder) {
    return {
      remoteState: null,
      recoveredManifest: false,
    };
  }

  const collectionsFolder = await findDriveFileByName({
    accessToken: options.accessToken,
    name: "collections",
    mimeType: DRIVE_FOLDER_MIME_TYPE,
    parentId: rootFolder.id,
  });
  const manifestFile = await findDriveFileByName({
    accessToken: options.accessToken,
    name: "manifest.json",
    parentId: rootFolder.id,
  });

  if (manifestFile) {
    try {
      const manifest = await readDriveJsonFile<DriveManifestPayload>(
        options.accessToken,
        manifestFile.id,
      );

      const collections = await Promise.all(
        (manifest.collections ?? []).map(async (record) => {
          const remoteCollection = await readDriveJsonFile<
            SyncProjectionSnapshot["collections"][number]
          >(options.accessToken, record.fileId);

          return {
            ...remoteCollection,
            id: record.id,
            fileId: record.fileId,
            revision: record.revision,
            contentHash: record.contentHash,
          };
        }),
      );

      return {
        remoteState: {
          generatedAt: manifest.generatedAt ?? new Date().toISOString(),
          preferences: manifest.preferences ?? createDefaultRemotePreferences(),
          collections,
          deletedCollections: manifest.deletedCollections ?? [],
          rootFolderId: manifest.rootFolderId ?? rootFolder.id,
          collectionsFolderId: manifest.collectionsFolderId ?? collectionsFolder?.id,
        },
        recoveredManifest: false,
      };
    } catch {
      // Fall through to recovery from collection docs.
    }
  }

  if (!collectionsFolder) {
    return {
      remoteState: null,
      recoveredManifest: false,
    };
  }

  const recoveredState = await rebuildRemoteStateFromCollectionsFolder({
    accessToken: options.accessToken,
    rootFolderId: rootFolder.id,
    collectionsFolderId: collectionsFolder.id,
  });

  if (recoveredState.collections.length === 0) {
    return {
      remoteState: null,
      recoveredManifest: false,
    };
  }

  await writeManifestPayload({
    accessToken: options.accessToken,
    rootFolderId: rootFolder.id,
    existingManifestFileId: manifestFile?.id,
    payload: {
      generatedAt: recoveredState.generatedAt,
      rootFolderId: recoveredState.rootFolderId,
      collectionsFolderId: recoveredState.collectionsFolderId,
      preferences: recoveredState.preferences,
      collections: recoveredState.collections.map((collection) => ({
        id: collection.id,
        fileId: collection.fileId ?? "",
        revision: collection.revision,
        contentHash: collection.contentHash,
      })),
      deletedCollections: recoveredState.deletedCollections,
    },
  });

  return {
    remoteState: recoveredState,
    recoveredManifest: true,
  };
};

export const loadSyncProjectionFromGoogleDrive = async (options: {
  accessToken: string;
  rootFolderName?: string;
}): Promise<{
  remoteState: SyncProjectionRemoteState | null;
  recoveredManifest: boolean;
}> => loadRemoteStateWithRecovery(options);

export const loadGoogleDriveWorkspaceSummary = async (options: {
  accessToken: string;
  rootFolderName?: string;
}): Promise<{
  rootFolderId: string | null;
  collectionsFolderId: string | null;
  manifestCollectionCount: number;
  deletedCollectionCount: number;
  hasManifest: boolean;
  recoveredManifest: boolean;
}> => {
  const result = await loadRemoteStateWithRecovery(options);
  if (!result.remoteState) {
    return {
      rootFolderId: null,
      collectionsFolderId: null,
      manifestCollectionCount: 0,
      deletedCollectionCount: 0,
      hasManifest: false,
      recoveredManifest: false,
    };
  }

  return {
    rootFolderId: result.remoteState.rootFolderId ?? null,
    collectionsFolderId: result.remoteState.collectionsFolderId ?? null,
    manifestCollectionCount: result.remoteState.collections.length,
    deletedCollectionCount: result.remoteState.deletedCollections.length,
    hasManifest: true,
    recoveredManifest: result.recoveredManifest,
  };
};

export const loadGoogleIdentityServices = async (): Promise<void> => {
  if (typeof window === "undefined") {
    throw new Error("Google Identity Services require a browser environment.");
  }

  if (window.google?.accounts?.oauth2) {
    return;
  }

  if (!gisLoadPromise) {
    gisLoadPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${GOOGLE_GIS_SCRIPT_URL}"]`,
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("Failed to load Google Identity Services.")),
          { once: true },
        );
        return;
      }

      const script = document.createElement("script");
      script.src = GOOGLE_GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Failed to load Google Identity Services."));
      document.head.appendChild(script);
    });
  }

  return gisLoadPromise;
};

export const requestGoogleDriveAccessToken = async (options: {
  clientId: string;
  prompt?: string;
}): Promise<string> => {
  await loadGoogleIdentityServices();

  const promptValue = options.prompt ?? "consent";

  // Try silent auth first if prompt is not forced to "consent"
  if (promptValue !== "consent") {
    try {
      const silentToken = await new Promise<string>((resolve, reject) => {
        const tokenClient = window.google?.accounts.oauth2.initTokenClient({
          client_id: options.clientId,
          scope: GOOGLE_DRIVE_SCOPE,
          callback: (response) => {
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(
                new Error(
                  response.error_description ?? response.error ?? "Silent auth failed",
                ),
              );
            }
          },
          error_callback: (error) => {
            reject(
              new Error(
                error.type === "popup_closed"
                  ? "popup_closed"
                  : "Silent auth error",
              ),
            );
          },
        });
        tokenClient?.requestAccessToken({ prompt: "none" });
      });
      return silentToken;
    } catch {
      // Silent auth failed — fall through to interactive
    }
  }

  // Interactive auth (shows Google consent popup)
  return new Promise<string>((resolve, reject) => {
    const tokenClient = window.google?.accounts.oauth2.initTokenClient({
      client_id: options.clientId,
      scope: GOOGLE_DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(
            new Error(
              response.error_description ??
                response.error ??
                "Google Drive access was not granted.",
            ),
          );
          return;
        }

        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(
          new Error(
            error.type === "popup_closed"
              ? "The Google authorization popup was closed before completion."
              : "Unable to authorize Google Drive access.",
          ),
        );
      },
    });

    tokenClient?.requestAccessToken({ prompt: promptValue });
  });
};

export const revokeGoogleDriveAccessToken = async (
  accessToken: string,
): Promise<void> => {
  if (!accessToken || !window.google?.accounts.oauth2) {
    return;
  }

  await new Promise<void>((resolve) => {
    window.google?.accounts.oauth2.revoke(accessToken, () => resolve());
  });
};

export const ensureDriveFolder = async (options: {
  accessToken: string;
  name: string;
  parentId?: string;
}): Promise<DriveFileResponse> => {
  const existingFolder = await findDriveFileByName({
    accessToken: options.accessToken,
    name: options.name,
    mimeType: DRIVE_FOLDER_MIME_TYPE,
    parentId: options.parentId,
  });

  if (existingFolder) {
    return existingFolder;
  }

  return createDriveFolder(options);
};

export const syncProjectionToGoogleDrive = async (options: {
  accessToken: string;
  snapshot: SyncProjectionSnapshot;
  rootFolderName?: string;
}): Promise<{
  syncedAt: string;
  rootFolderId: string;
  collectionsFolderId: string;
  manifestFileId: string;
  syncedCollections: Array<{
    id: string;
    fileId: string;
    revision?: string;
    contentHash: string;
  }>;
  skippedCollections: Array<{
    id: string;
    fileId: string;
    revision?: string;
    contentHash: string;
  }>;
  clearedDeletedCollectionIds: string[];
}> => {
  const syncedAt = new Date().toISOString();
  const rootFolder = await ensureDriveFolder({
    accessToken: options.accessToken,
    name: options.rootFolderName ?? "time-horizon",
  });
  const collectionsFolder = await ensureDriveFolder({
    accessToken: options.accessToken,
    name: "collections",
    parentId: rootFolder.id,
  });
  const existingStateResult = await loadRemoteStateWithRecovery({
    accessToken: options.accessToken,
    rootFolderName: options.rootFolderName,
  });
  const existingManifestCollections = new Map(
    (existingStateResult.remoteState?.collections ?? []).map((collection) => [
      collection.id,
      {
        id: collection.id,
        fileId: collection.fileId ?? "",
        revision: collection.revision,
        contentHash: collection.contentHash,
      },
    ]),
  );

  const syncedCollections: Array<{
    id: string;
    fileId: string;
    revision?: string;
    contentHash: string;
  }> = [];
  const skippedCollections: Array<{
    id: string;
    fileId: string;
    revision?: string;
    contentHash: string;
  }> = [];

  for (const collection of options.snapshot.collections) {
    const payload = {
      ...collection,
      syncedAt,
    };
    const contentHash = hashContent(JSON.stringify(payload, null, 2));
    const manifestCollection = existingManifestCollections.get(collection.id);

    if (
      manifestCollection?.fileId &&
      manifestCollection.contentHash === contentHash
    ) {
      skippedCollections.push({
        id: collection.id,
        fileId: manifestCollection.fileId,
        revision: manifestCollection.revision,
        contentHash,
      });
      continue;
    }

    const result = await upsertDriveJsonFile({
      accessToken: options.accessToken,
      folderId: collectionsFolder.id,
      fileName: `${collection.id}.json`,
      existingFileId: manifestCollection?.fileId,
      payload,
    });

    syncedCollections.push({
      id: collection.id,
      fileId: result.fileId,
      revision: result.revision,
      contentHash: result.contentHash,
    });
  }

  const manifestCollections = [
    ...syncedCollections,
    ...skippedCollections,
  ].sort((left, right) => left.id.localeCompare(right.id));

  const manifestPayload = {
    ...options.snapshot,
    generatedAt: syncedAt,
    rootFolderId: rootFolder.id,
    collectionsFolderId: collectionsFolder.id,
    collections: manifestCollections.map((collection) => ({
      id: collection.id,
      fileId: collection.fileId,
      revision: collection.revision,
      contentHash: collection.contentHash,
    })),
  };

  const existingManifestFile = await findDriveFileByName({
    accessToken: options.accessToken,
    name: "manifest.json",
    parentId: rootFolder.id,
  });

  const manifestResult = await writeManifestPayload({
    accessToken: options.accessToken,
    rootFolderId: rootFolder.id,
    existingManifestFileId: existingManifestFile?.id,
    payload: manifestPayload,
  });

  return {
    syncedAt,
    rootFolderId: rootFolder.id,
    collectionsFolderId: collectionsFolder.id,
    manifestFileId: manifestResult.fileId,
    syncedCollections,
    skippedCollections,
    clearedDeletedCollectionIds: options.snapshot.deletedCollections.map(
      (collection) => collection.id,
    ),
  };
};
