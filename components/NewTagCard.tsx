import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { forwardRef, useImperativeHandle, useRef } from 'react';

type NewTagCardProps = {
  newTagName: string;
  onTagNameChange: (text: string) => void;
  onAdd: () => void;
  isSaving: boolean;
  error?: string;
};

export const NewTagCard = forwardRef<TextInput, NewTagCardProps>(function NewTagCard(
  { newTagName, onTagNameChange, onAdd, isSaving, error },
  ref
) {
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
  } as TextInput));

  const canAdd = newTagName.trim().length > 0 && !isSaving;

  return (
    <View
      className="mx-5 mt-5 mb-4 rounded-2xl bg-white px-4 py-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text className="mb-3 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
        Create a new tag
      </Text>
      
      <View className="mb-2">
        <TextInput
          ref={inputRef}
          placeholder="New tag name"
          placeholderTextColor="#9ca3af"
          value={newTagName}
          onChangeText={onTagNameChange}
          onSubmitEditing={canAdd ? onAdd : undefined}
          maxLength={30}
          className="rounded-2xl border bg-gray-50 px-4 py-3 text-[16px] text-gray-900"
          style={{
            borderColor: error ? '#ef4444' : '#e5e7eb',
            letterSpacing: -0.2,
          }}
        />
        {error && (
          <Text className="mt-1.5 text-[12px] text-red-600">{error}</Text>
        )}
      </View>

      <TouchableOpacity
        onPress={onAdd}
        disabled={!canAdd}
        activeOpacity={canAdd ? 0.85 : 1}
        className="w-full rounded-2xl py-3"
        style={{
          backgroundColor: canAdd ? '#b38f5b' : '#e5e7eb',
          shadowColor: canAdd ? '#b38f5b' : 'transparent',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: canAdd ? 0.2 : 0,
          shadowRadius: 8,
          elevation: canAdd ? 3 : 0,
        }}
      >
        {isSaving ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            <Text className="text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
              Adding...
            </Text>
          </View>
        ) : (
          <Text className="text-center text-[16px] font-semibold text-white" style={{ letterSpacing: -0.2 }}>
            Add
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
});

