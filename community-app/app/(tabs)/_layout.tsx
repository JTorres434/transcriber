import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { getAuth } from 'firebase/auth';
import { getUserProfile, UserProfile } from '../../lib/firestore';
import { colors } from '../../constants/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
  );
}

export default function TabsLayout() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const user = getAuth().currentUser;
    if (!user) return;
    getUserProfile(user.uid).then(profile => {
      setIsAdmin(profile?.isAdmin ?? false);
    });
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: colors.bg,
        },
        headerTitleStyle: {
          fontWeight: '700',
          color: colors.ink,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Community',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏘️" focused={focused} />,
          headerTitle: 'GK Magalang',
        }}
      />
      <Tabs.Screen
        name="my-account"
        options={{
          title: 'My Account',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          headerTitle: 'My Account',
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🛡️" focused={focused} />,
          headerTitle: 'Admin Panel',
          href: isAdmin ? '/(tabs)/admin' : null,
        }}
      />
    </Tabs>
  );
}
