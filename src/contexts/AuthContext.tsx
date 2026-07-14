import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import thư viện mới

type AuthContextType = {
  user: any;
  isLoading: boolean; // Thêm cờ loading để chờ check bộ nhớ
  login: (userData: any) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Tự động chạy 1 lần khi mở app: Kiểm tra xem đã đăng nhập trước đó chưa
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user_data');
        if (storedUser) {
          setUser(JSON.parse(storedUser)); // Nếu có thì tự đăng nhập luôn
        }
      } catch (error) {
        console.error("Lỗi khi load user từ bộ nhớ:", error);
      } finally {
        setIsLoading(false); // Xong thì tắt cờ loading
      }
    };
    loadUser();
  }, []);

  // Khi login thành công, lưu vào bộ nhớ máy
  const login = async (userData: any) => {
    try {
      setUser(userData);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
    } catch (error) {
      console.error("Lỗi khi lưu user:", error);
    }
  };

  // Khi logout, xóa khỏi bộ nhớ máy
  const logout = async () => {
    try {
      setUser(null);
      await AsyncStorage.removeItem('user_data');
    } catch (error) {
      console.error("Lỗi khi xóa user:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);