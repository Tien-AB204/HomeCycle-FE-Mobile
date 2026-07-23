import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import apiClient from '../config/api'; 
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>; 
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const reloadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) return;

      const profileResponse = await apiClient.get('/personals/me');
      const profileData = profileResponse.data.data;

      setUser({
        // THÔNG TIN CƠ BẢN
        id: profileData.userId,
        username: profileData.username,
        email: profileData.email,
        name: profileData.fullName,
        avatar: profileData.avatarUrl,
        role: profileData.role ? profileData.role.toLowerCase() : 'personal',
        createdAt: profileData.createdAt,
        phone: profileData.phoneNumber,
        status: profileData.status,
        verificationStatus: profileData.verificationStatus,
        reputationScore: profileData.reputationScore,
        isEmailVerified: profileData.isEmailVerified,
        address: profileData.address || '',
        
        // THÔNG TIN PHÁP LÝ & NGÂN HÀNG
        representativeCode: profileData.representativeCode,
        representativeName: profileData.representativeName,
        representativeDob: profileData.representativeDob,
        representativeAddress: profileData.representativeAddress,
        frontIDCardImage: profileData.frontIDCardImage,
        backIDCardImage: profileData.backIDCardImage,
        bankAccount: profileData.bankAccount || null,
      });
    } catch (error) {
      console.log("Token expired or API error:", error);
      await AsyncStorage.removeItem('accessToken');
      setUser(null);
    }
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      setIsLoading(true);
      await reloadUser();
      setIsLoading(false);
    };
    checkLoginStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const loginResponse = await apiClient.post('/auth/login', { email, password });
      await AsyncStorage.setItem('accessToken', loginResponse.data.accessToken);
      
      await reloadUser(); 
      router.replace('/(tabs)');

    } catch (error: any) {
      console.error("Login Error:", error);
      throw new Error(error.response?.data?.message || 'Đăng nhập thất bại. Vui lòng thử lại!');
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('accessToken');
    setUser(null);
    router.replace('/(auth)/login');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};