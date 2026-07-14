import React from 'react';
import Header from './Header'; 
import { TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useRouter } from 'expo-router';

export default function MainHeader({ title, showBack, centerContent }: { title?: string, showBack?: boolean, centerContent?: React.ReactNode }) {
  const router = useRouter();

  const renderRightButtons = () => (
    <>
      <TouchableOpacity onPress={() => router.push('/chat' as any)}>
        <Ionicons name="chatbubbles-outline" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/notifications' as any)}>
        <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
        <Ionicons name="person-circle-outline" size={24} color={COLORS.text} />
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