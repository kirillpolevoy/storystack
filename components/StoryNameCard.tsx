import { Text, TextInput, View } from 'react-native';

type StoryNameCardProps = {
  storyName: string;
  onStoryNameChange: (text: string) => void;
};

export function StoryNameCard({ storyName, onStoryNameChange }: StoryNameCardProps) {
  return (
    <View
      className="mx-5 mb-4 rounded-2xl bg-white px-4 py-4"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text className="mb-2 text-[13px] font-semibold text-gray-700" style={{ letterSpacing: -0.1 }}>
        Story name
      </Text>
      <TextInput
        placeholder="e.g. Aria launch, Layered looks, Holiday drop"
        placeholderTextColor="#9ca3af"
        value={storyName}
        onChangeText={(text) => {
          if (text.length <= 50) {
            onStoryNameChange(text);
          }
        }}
        maxLength={50}
        className="text-[16px] text-gray-900"
        style={{ letterSpacing: -0.2 }}
      />
      {storyName.trim().length === 0 && (
        <Text className="mt-2 text-[12px] text-gray-500">
          A story name is required to export
        </Text>
      )}
    </View>
  );
}

