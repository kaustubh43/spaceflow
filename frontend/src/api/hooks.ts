import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BOMReport,
  CatalogItem,
  Comment,
  ElementModel,
  Floor,
  Project,
  Snapshot,
} from "@/types";

// ---- Projects ----
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: async () => (await api.get<Project[]>("/projects")).data,
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Project>) =>
      (await api.post<Project>("/projects", body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Project>) =>
      (await api.patch<Project>(`/projects/${id}`, body)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => api.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

// ---- Members ----
export function useAddMember(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { email: string; role: string }) =>
      (await api.post(`/projects/${projectId}/members`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

export function useRemoveMember(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (membershipId: number) =>
      api.delete(`/projects/${projectId}/members/${membershipId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });
}

// ---- Floors ----
export function useFloors(projectId: number) {
  return useQuery({
    queryKey: ["floors", projectId],
    queryFn: async () =>
      (await api.get<Floor[]>(`/projects/${projectId}/floors`)).data,
    enabled: !!projectId,
  });
}

export function useCreateFloor(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Floor>) =>
      (await api.post<Floor>(`/projects/${projectId}/floors`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["floors", projectId] }),
  });
}

export function useUpdateFloor(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<Floor> }) =>
      (await api.patch<Floor>(`/projects/${projectId}/floors/${id}`, body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["floors", projectId] }),
  });
}

// ---- Elements ----
export function useElements(projectId: number, floorId?: number) {
  return useQuery({
    queryKey: ["elements", projectId, floorId],
    queryFn: async () =>
      (
        await api.get<ElementModel[]>(
          `/projects/${projectId}/floors/${floorId}/elements`
        )
      ).data,
    enabled: !!projectId && !!floorId,
  });
}

// ---- Catalog ----
export function useCatalog() {
  return useQuery({
    queryKey: ["catalog"],
    queryFn: async () => (await api.get<CatalogItem[]>("/catalog")).data,
    staleTime: 1000 * 60 * 30,
  });
}

// ---- Comments ----
export function useComments(projectId: number, floorId?: number) {
  return useQuery({
    queryKey: ["comments", projectId, floorId],
    queryFn: async () =>
      (
        await api.get<Comment[]>(
          `/projects/${projectId}/floors/${floorId}/comments`
        )
      ).data,
    enabled: !!projectId && !!floorId,
  });
}

export function useCreateComment(projectId: number, floorId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Comment>) =>
      (
        await api.post(
          `/projects/${projectId}/floors/${floorId}/comments`,
          body
        )
      ).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["comments", projectId, floorId] }),
  });
}

export function useUpdateComment(projectId: number, floorId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<Comment> }) =>
      (
        await api.patch(
          `/projects/${projectId}/floors/${floorId}/comments/${id}`,
          body
        )
      ).data,
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["comments", projectId, floorId] }),
  });
}

// ---- BOM ----
export function useBOM(projectId: number) {
  return useQuery({
    queryKey: ["bom", projectId],
    queryFn: async () =>
      (await api.get<BOMReport>(`/projects/${projectId}/bom`)).data,
    enabled: !!projectId,
  });
}

// ---- Snapshots ----
export function useSnapshots(projectId: number) {
  return useQuery({
    queryKey: ["snapshots", projectId],
    queryFn: async () =>
      (await api.get<Snapshot[]>(`/projects/${projectId}/snapshots`)).data,
    enabled: !!projectId,
  });
}

export function useCreateSnapshot(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (label: string) =>
      (await api.post(`/projects/${projectId}/snapshots`, { label })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snapshots", projectId] }),
  });
}

export function useRestoreSnapshot(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) =>
      api.post(`/projects/${projectId}/snapshots/${id}/restore`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["elements"] }),
  });
}
