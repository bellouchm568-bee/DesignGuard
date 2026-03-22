// Mock Firebase/Firestore using LocalStorage for users who declined Firebase setup

export interface AnalysisRecord {
  id?: string;
  userId: string;
  type: 'text' | 'image';
  input: string;
  result: any;
  riskLevel: 'low' | 'medium' | 'high';
  createdAt: { toDate: () => Date };
}

// Mock Auth
const MOCK_USER = {
  uid: 'guest-user',
  email: 'guest@example.com',
  displayName: 'Guest User',
  photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest'
};

export const auth = {
  currentUser: MOCK_USER,
  onAuthStateChanged: (callback: (user: any) => void) => {
    callback(MOCK_USER);
    return () => {};
  },
  signOut: async () => {
    console.log("Sign out not supported in guest mode");
  }
};

export const signIn = async () => {
  console.log("Sign in not supported in guest mode");
};

export const signOut = async () => {
  console.log("Sign out not supported in guest mode");
};

// Mock Firestore
const STORAGE_KEY = 'designguard_analyses';

export function subscribeToAnalyses(userId: string, callback: (analyses: AnalysisRecord[]) => void) {
  const load = () => {
    const data = localStorage.getItem(STORAGE_KEY);
    const analyses = data ? JSON.parse(data) : [];
    // Convert string dates back to mock Firestore timestamps
    const formatted = analyses
      .filter((a: any) => a.userId === userId)
      .map((a: any) => ({
        ...a,
        createdAt: { toDate: () => new Date(a.createdAt) }
      }))
      .sort((a: any, b: any) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
    callback(formatted);
  };

  load();
  window.addEventListener('storage', load);
  return () => window.removeEventListener('storage', load);
}

export async function saveAnalysis(analysis: Omit<AnalysisRecord, 'id' | 'createdAt'>) {
  const data = localStorage.getItem(STORAGE_KEY);
  const analyses = data ? JSON.parse(data) : [];
  
  const newRecord = {
    ...analysis,
    id: Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString()
  };
  
  analyses.push(newRecord);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(analyses));
  
  // Trigger storage event for local listeners
  window.dispatchEvent(new Event('storage'));
  return newRecord;
}

export async function deleteAnalysis(id: string) {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return;
  
  const analyses = JSON.parse(data);
  const filtered = analyses.filter((a: any) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  
  window.dispatchEvent(new Event('storage'));
}
