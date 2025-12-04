import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import * as Haptics from 'expo-haptics';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for auto-focus
  const passwordInputRef = useRef<TextInput>(null);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const logoScaleAnim = useRef(new Animated.Value(0.9)).current;
  const emailBorderAnim = useRef(new Animated.Value(0)).current;
  const passwordBorderAnim = useRef(new Animated.Value(0)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;
  const errorOpacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Refined entrance animation - Apple's signature smoothness
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 100,
        friction: 20,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Animate input borders on focus - refined spring physics
  useEffect(() => {
    Animated.spring(emailBorderAnim, {
      toValue: emailFocused ? 1 : 0,
      tension: 200,
      friction: 20,
      useNativeDriver: false,
    }).start();
    
    if (emailFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [emailFocused]);

  useEffect(() => {
    Animated.spring(passwordBorderAnim, {
      toValue: passwordFocused ? 1 : 0,
      tension: 200,
      friction: 20,
      useNativeDriver: false,
    }).start();
    
    if (passwordFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [passwordFocused]);

  // Animate error message with refined timing
  useEffect(() => {
    if (error) {
      Animated.spring(errorOpacityAnim, {
        toValue: 1,
        tension: 150,
        friction: 15,
        useNativeDriver: true,
      }).start();
    } else {
      errorOpacityAnim.setValue(0);
    }
  }, [error]);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    setError(null);
    setIsSigningIn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const { error: signInError } = await signIn(email.trim(), password);
    setIsSigningIn(false);

    if (signInError) {
      let errorMessage = signInError.message || 'Please check your credentials and try again';
      
      if (signInError.message?.includes('Invalid login credentials') || signInError.message?.includes('invalid')) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (signInError.message?.includes('Email not confirmed')) {
        errorMessage = 'Please verify your email address before signing in.';
      }
      
      setError(errorMessage);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleButtonPress = () => {
    Animated.sequence([
      Animated.spring(buttonScaleAnim, {
        toValue: 0.97,
        tension: 400,
        friction: 15,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScaleAnim, {
        toValue: 1,
        tension: 400,
        friction: 15,
        useNativeDriver: true,
      }),
    ]).start();
    handleSignIn();
  };

  const handleShowPassword = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowPassword(!showPassword);
  };

  const emailBorderColor = emailBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.1)', '#b38f5b'],
  });

  const passwordBorderColor = passwordBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0, 0, 0, 0.1)', '#b38f5b'],
  });

  const isFormValid = email.trim() && password.trim();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#ffffff' }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: Math.max(insets.top + 32, 80),
          paddingBottom: Math.max(insets.bottom + 40, 60),
          paddingHorizontal: 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={{ 
            flex: 1, 
            justifyContent: 'center', 
            maxWidth: 400, 
            width: '100%', 
            alignSelf: 'center',
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}
        >
          {/* Logo - Premium gold icon */}
          <View style={{ alignItems: 'center', marginBottom: 48 }}>
            <Animated.View
              style={{
                width: 96,
                height: 96,
                borderRadius: 24,
                backgroundColor: '#b38f5b',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 28,
                shadowColor: '#b38f5b',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.35,
                shadowRadius: 24,
                elevation: 12,
                transform: [{ scale: logoScaleAnim }],
              }}
            >
              {/* Inner glow effect */}
              <View
                style={{
                  position: 'absolute',
                  width: 96,
                  height: 96,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                }}
              />
              <Text style={{ fontSize: 48, fontWeight: '800', color: '#ffffff', letterSpacing: -1.5 }}>
                S
              </Text>
            </Animated.View>
          </View>

          {/* Title Section - Apple's refined typography */}
          <View style={{ marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 34,
                fontWeight: '700',
                color: '#000000',
                letterSpacing: -0.6,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Welcome Back
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: '400',
                color: '#6b7280',
                letterSpacing: -0.2,
                lineHeight: 24,
                textAlign: 'center',
              }}
            >
              Sign in to continue to StoryStack
            </Text>
          </View>

          {/* Form - Refined inputs */}
          <View style={{ marginBottom: 32 }}>
            {/* Email Input */}
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#374151',
                  letterSpacing: 0.2,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}
              >
                Email
              </Text>
              <Animated.View
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: emailBorderColor,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  shadowColor: emailFocused ? '#b38f5b' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: emailFocused ? 0.15 : 0,
                  shadowRadius: 8,
                  elevation: emailFocused ? 3 : 0,
                }}
              >
                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  returnKeyType="next"
                  editable={!isSigningIn}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  onSubmitEditing={() => {
                    passwordInputRef.current?.focus();
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={{
                    fontSize: 17,
                    fontWeight: '400',
                    color: '#111827',
                    letterSpacing: -0.2,
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                />
              </Animated.View>
            </View>

            {/* Password Input */}
            <View style={{ marginBottom: 12 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: '#374151',
                  letterSpacing: 0.2,
                  marginBottom: 10,
                  textTransform: 'uppercase',
                }}
              >
                Password
              </Text>
              <Animated.View
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: passwordBorderColor,
                  backgroundColor: '#ffffff',
                  overflow: 'hidden',
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: passwordFocused ? '#b38f5b' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: passwordFocused ? 0.15 : 0,
                  shadowRadius: 8,
                  elevation: passwordFocused ? 3 : 0,
                }}
              >
                <TextInput
                  ref={passwordInputRef}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  returnKeyType="done"
                  editable={!isSigningIn}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onSubmitEditing={handleSignIn}
                  style={{
                    flex: 1,
                    fontSize: 17,
                    fontWeight: '400',
                    color: '#111827',
                    letterSpacing: -0.2,
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                />
                <TouchableOpacity
                  onPress={handleShowPassword}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 16,
                  }}
                  activeOpacity={0.6}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '500',
                      color: '#6b7280',
                      letterSpacing: -0.1,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View
                style={{
                  opacity: errorOpacityAnim,
                  marginTop: 12,
                  paddingHorizontal: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '500',
                    color: '#ef4444',
                    letterSpacing: -0.1,
                    lineHeight: 20,
                  }}
                >
                  {error}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* Sign In Button - Apple's prominent primary action */}
          <Animated.View
            style={{
              transform: [{ scale: buttonScaleAnim }],
            }}
          >
            <TouchableOpacity
              onPress={handleButtonPress}
              disabled={isSigningIn || authLoading || !isFormValid}
              activeOpacity={1}
              style={{
                width: '100%',
                borderRadius: 12,
                paddingVertical: 16,
                backgroundColor: isFormValid && !isSigningIn ? '#b38f5b' : '#e5e7eb',
                shadowColor: isFormValid && !isSigningIn ? '#b38f5b' : 'transparent',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: isFormValid && !isSigningIn ? 4 : 0,
                marginBottom: 24,
              }}
            >
              {isSigningIn ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 10 }} />
                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '600',
                      color: '#ffffff',
                      letterSpacing: -0.2,
                    }}
                  >
                    Signing In...
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '600',
                    color: isFormValid ? '#ffffff' : '#9ca3af',
                    letterSpacing: -0.2,
                    textAlign: 'center',
                  }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          {/* Sign Up Link - Refined secondary action */}
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/signup');
            }}
            style={{ alignItems: 'center', paddingVertical: 16 }}
            activeOpacity={0.6}
          >
            <Text
              style={{
                fontSize: 15,
                fontWeight: '400',
                color: '#6b7280',
                letterSpacing: -0.1,
              }}
            >
              Don't have an account?{' '}
              <Text
                style={{
                  fontWeight: '600',
                  color: '#b38f5b',
                }}
              >
                Sign Up
              </Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
