import { create } from 'zustand';

interface Connection {
  id: string;
  name: string;
}

interface ConnectionsState {
  connections: Connection[];
  selectedFriendIds: string[];
  isLoading: boolean;
  setConnections: (connections: Connection[]) => void;
  addConnection: (connection: Connection) => void;
  removeConnection: (id: string) => void;
  toggleFriendSelection: (id: string) => void;
  setLoading: (isLoading: boolean) => void;
  clearSelection: () => void;
}

export const useConnectionsStore = create<ConnectionsState>((set) => ({
  connections: [],
  selectedFriendIds: [],
  isLoading: false,
  setConnections: (connections) => set({ connections }),
  addConnection: (connection) =>
    set((state) => ({
      connections: [...state.connections, connection],
    })),
  removeConnection: (id) =>
    set((state) => ({
      connections: state.connections.filter((c) => c.id !== id),
      selectedFriendIds: state.selectedFriendIds.filter((fid) => fid !== id),
    })),
  toggleFriendSelection: (id) =>
    set((state) => ({
      selectedFriendIds: state.selectedFriendIds.includes(id)
        ? state.selectedFriendIds.filter((fid) => fid !== id)
        : [...state.selectedFriendIds, id],
    })),
  setLoading: (isLoading) => set({ isLoading }),
  clearSelection: () => set({ selectedFriendIds: [] }),
}));
