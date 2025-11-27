# OAuth Code Examples

## 1. Updated AuthContext with OAuth Methods

```typescript
// contexts/AuthContext.tsx additions

import * as AuthSession from 'expo-auth-session';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

type AuthContextType = {
  // ... existing methods
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithApple: () => Promise<{ error: any }>;
  linkGoogleAccount: () => Promise<{ error: any }>;
  linkAppleAccount: () => Promise<{ error: any }>;
  unlinkProvider: (provider: string) => Promise<{ error: any }>;
  getLinkedAccounts: () => Promise<{ providers: string[] }>;
};

// In AuthProvider:

const signInWithGoogle = async () => {
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const redirectTo = `${supabaseUrl}/auth/v1/callback`;
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
        skipBrowserRedirect: false,
      },
    });
    
    if (error) return { error };
    
    // Handle the OAuth flow
    // Supabase will redirect to your app via deep link
    return { error: null };
  } catch (error) {
    return { error };
  }
};

const signInWithApple = async () => {
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  
  try {
    // For iOS, use native Apple Sign In
    if (Platform.OS === 'ios') {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      // Exchange Apple credential for Supabase session
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
        nonce: credential.nonce,
      });
      
      if (error) return { error };
      return { error: null };
    } else {
      // For Android/Web, use OAuth flow
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
      const redirectTo = `${supabaseUrl}/auth/v1/callback`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: redirectTo,
        },
      });
      
      if (error) return { error };
      return { error: null };
    }
  } catch (error) {
    return { error };
  }
};

const linkGoogleAccount = async () => {
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not signed in' } };
    
    // Check if already linked
    const { data: identities } = await supabase.auth.getUserIdentities();
    if (identities?.some(id => id.provider === 'google')) {
      return { error: { message: 'Google account already linked' } };
    }
    
    // Start OAuth flow for linking
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
    const redirectTo = `${supabaseUrl}/auth/v1/callback`;
    
    const { data, error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });
    
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error };
  }
};

const linkAppleAccount = async () => {
  // Similar to linkGoogleAccount but for Apple
  // ...
};

const unlinkProvider = async (provider: string) => {
  if (!supabase) return { error: { message: 'Supabase not configured' } };
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: { message: 'Not signed in' } };
    
    // Get all identities
    const { data: identities } = await supabase.auth.getUserIdentities();
    
    // Can't unlink if it's the only provider
    if (identities && identities.length <= 1) {
      return { error: { message: 'Cannot unlink last authentication method' } };
    }
    
    // Find the identity to unlink
    const identityToUnlink = identities?.find(id => id.provider === provider);
    if (!identityToUnlink) {
      return { error: { message: `${provider} account not linked` } };
    }
    
    // Unlink the provider
    const { error } = await supabase.auth.unlinkIdentity({
      provider: provider,
      identityId: identityToUnlink.id,
    });
    
    if (error) return { error };
    return { error: null };
  } catch (error) {
    return { error };
  }
};

const getLinkedAccounts = async () => {
  if (!supabase) return { providers: [] };
  
  try {
    const { data: identities } = await supabase.auth.getUserIdentities();
    return { providers: identities?.map(id => id.provider) || [] };
  } catch (error) {
    return { providers: [] };
  }
};
```

## 2. OAuth Button Components

```typescript
// components/OAuthButton.tsx

import { TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export function GoogleSignInButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className="w-full rounded-2xl border bg-white py-4"
      style={{
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#374151" />
      ) : (
        <View className="flex-row items-center justify-center">
          <MaterialCommunityIcons name="google" size={20} color="#4285F4" style={{ marginRight: 8 }} />
          <Text className="text-[16px] font-semibold text-gray-900" style={{ letterSpacing: -0.2 }}>
            Continue with Google
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function AppleSignInButton({ onPress, loading }: { onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className="w-full rounded-2xl bg-black py-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {loading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <View className="flex-row items-center justify-center">
          <MaterialCommunityIcons name="apple" size={20} color="#ffffff" style={{ marginRight: 8 }} />
          <Text className="text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
            Continue with Apple
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

## 3. Account Linking UI in Profile

```typescript
// Add to app/profile.tsx

const [linkedAccounts, setLinkedAccounts] = useState<string[]>([]);
const [isLinking, setIsLinking] = useState<string | null>(null);

useEffect(() => {
  loadLinkedAccounts();
}, [user]);

const loadLinkedAccounts = async () => {
  const { providers } = await getLinkedAccounts();
  setLinkedAccounts(providers);
};

const handleLinkProvider = async (provider: 'google' | 'apple') => {
  setIsLinking(provider);
  try {
    if (provider === 'google') {
      await linkGoogleAccount();
    } else {
      await linkAppleAccount();
    }
    await loadLinkedAccounts();
    Alert.alert('Success', `${provider} account linked successfully`);
  } catch (error) {
    Alert.alert('Error', `Failed to link ${provider} account`);
  } finally {
    setIsLinking(null);
  }
};

const handleUnlinkProvider = async (provider: string) => {
  Alert.alert(
    'Unlink Account',
    `Are you sure you want to unlink your ${provider} account?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: async () => {
          const { error } = await unlinkProvider(provider);
          if (error) {
            Alert.alert('Error', error.message);
          } else {
            await loadLinkedAccounts();
            Alert.alert('Success', `${provider} account unlinked`);
          }
        },
      },
    ]
  );
};

// In render:
<View className="mb-6">
  <Text className="mb-3 text-[15px] font-semibold text-gray-900">Linked Accounts</Text>
  <View className="rounded-2xl bg-white p-4">
    {/* Email/Password */}
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center">
        <MaterialCommunityIcons name="email" size={20} color="#6b7280" />
        <Text className="ml-3 text-[15px] text-gray-900">Email</Text>
      </View>
      <Text className="text-[13px] text-gray-500">{user?.email}</Text>
    </View>
    
    {/* Google */}
    {linkedAccounts.includes('google') ? (
      <View className="flex-row items-center justify-between border-t border-gray-100 py-3">
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
          <Text className="ml-3 text-[15px] text-gray-900">Google</Text>
        </View>
        <TouchableOpacity onPress={() => handleUnlinkProvider('google')}>
          <Text className="text-[13px] font-medium text-red-600">Unlink</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <TouchableOpacity
        onPress={() => handleLinkProvider('google')}
        disabled={isLinking === 'google'}
        className="flex-row items-center justify-between border-t border-gray-100 py-3"
      >
        <View className="flex-row items-center">
          <MaterialCommunityIcons name="google" size={20} color="#4285F4" />
          <Text className="ml-3 text-[15px] text-gray-900">Google</Text>
        </View>
        {isLinking === 'google' ? (
          <ActivityIndicator size="small" color="#b38f5b" />
        ) : (
          <Text className="text-[13px] font-medium text-[#b38f5b]">Link</Text>
        )}
      </TouchableOpacity>
    )}
    
    {/* Apple - similar structure */}
  </View>
</View>
```

## 4. Deep Link Handling

Update `app/auth/callback.tsx` to handle OAuth callbacks:

```typescript
// Handle OAuth callback
useEffect(() => {
  const handleOAuthCallback = async () => {
    const url = await Linking.getInitialURL();
    if (url && url.includes('auth/callback')) {
      // Extract tokens from URL
      const { data, error } = await supabase.auth.getSessionFromUrl(url);
      if (error) {
        console.error('OAuth callback error:', error);
        router.replace('/login');
      } else {
        // Success - session is set automatically
        router.replace('/');
      }
    }
  };
  
  handleOAuthCallback();
}, []);
```


