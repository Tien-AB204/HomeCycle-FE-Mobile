import React, { useState } from 'react';
import Header from './Header'; 
import { TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext'; // Nhập AuthContext

export default function MainHeader({ title, showBack, centerContent }: { title?: string, showBack?: boolean, centerContent?: React.ReactNode }) {
  const router = useRouter();
  
  // Lấy dữ liệu user từ Context
  const { user } = useAuth();
  const [imageError, setImageError] = useState(false);

  // LOGIC XỬ LÝ AVATAR CHỐNG LỖI
  const isValidAvatar = user?.avatar && user.avatar !== 'string' && user.avatar !== 'null';
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'U')}&background=208AEF&color=fff&size=100`;
  const avatarSource = (isValidAvatar && !imageError) ? { uri: user.avatar } : { uri: defaultAvatar };

  const renderRightButtons = () => (
    <>
      <TouchableOpacity onPress={() => router.push('/chat' as any)}>
        <Ionicons name="chatbubbles-outline" size={24} color={COLORS.text} />
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => router.push('/notifications' as any)}>
        <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
      </TouchableOpacity>
      
      {/* KHU VỰC AVATAR CÁ NHÂN */}
      <TouchableOpacity 
        onPress={() => router.push('/(tabs)/profile')}
        style={{ justifyContent: 'center', alignItems: 'center' }}
      >
        {user ? (
          <Image 
            source={avatarSource} 
            style={{ 
              width: 28, 
              height: 28, 
              borderRadius: 14, // Bo tròn hoàn hảo
              backgroundColor: '#E2E8F0',
              borderWidth: 1,
              borderColor: '#E2E8F0'
            }} 
            onError={() => setImageError(true)}
          />
        ) : (
          <Ionicons name="person-circle-outline" size={28} color={COLORS.text} />
        )}
      </TouchableOpacity>
    </>
  );

  // LOGIC MỚI: Nếu là Trang chủ, hiển thị Logo gốc
  const isHome = title === 'HomeCycle';

  const renderLeft = isHome ? (
    <Image 
      source={require('../../../assets/images/logo-dark-transparent.png')} 
      style={{ width: 140, height: 32, marginLeft: 4 }}
      resizeMode="contain"
    />
  ) : null;

  return (
    <Header 
      title={isHome ? undefined : title} // Giấu chữ đi nếu đang hiển thị Logo
      showBack={showBack} 
      centerContent={centerContent} 
      leftContent={renderLeft} // Nạp logo vào góc trái
      rightContent={renderRightButtons()} 
    />
  );
}