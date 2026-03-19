import { createContext, useContext, useState, type ReactNode } from 'react';

type Role = 'admin' | 'kitchen' | 'billing';

interface AuthContextType {
  token: string | null;
  role: Role | null;
  restaurantId: number | null;
  login: (token: string, role: Role, restaurantId: number) => void;
  logout: (details?: Record<string, unknown>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  role: null,
  restaurantId: null,
  login: () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [role, setRole] = useState<Role | null>(localStorage.getItem('role') as Role | null);
  const [restaurantId, setRestaurantId] = useState<number | null>(
    localStorage.getItem('restaurantId') ? Number(localStorage.getItem('restaurantId')) : null
  );

  const login = (newToken: string, newRole: Role, newRestaurantId: number) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('role', newRole);
    localStorage.setItem('restaurantId', String(newRestaurantId));
    setToken(newToken);
    setRole(newRole);
    setRestaurantId(newRestaurantId);
  };

  const logout = async (details?: Record<string, unknown>) => {
    try {
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ details })
        });
      }
    } catch (err) {
      console.error('Failed to log logout activity:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('restaurantId');
      setToken(null);
      setRole(null);
      setRestaurantId(null);
    }
  };

  return (
    <AuthContext.Provider value={{ token, role, restaurantId, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
