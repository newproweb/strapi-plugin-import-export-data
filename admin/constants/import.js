export const ID_FIELDS = [
  { value: "documentId", label: "documentId (recommended)" },
  { value: "id", label: "id (database id)" },
  { value: "slug", label: "slug" },
  { value: "email", label: "email" },
  { value: "name", label: "name" },
];

export const EXISTING_ACTIONS = [
  { value: "update", label: "Update existing" },
  { value: "skip", label: "Skip if exists" },
  { value: "createNew", label: "Always create new" },
];
