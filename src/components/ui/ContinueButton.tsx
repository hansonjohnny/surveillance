import { TouchableOpacity, View, Text } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface ContinueButtonProps {
  onPress: () => void;
  enabled?: boolean;
  label?: string;
}

export function ContinueButton({ onPress, enabled = true, label = 'CONTINUE' }: ContinueButtonProps) {
  const bg = enabled ? colors.accent : 'rgba(255,255,255,0.06)';
  const fg = enabled ? colors.bg.primary : colors.text.tertiary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!enabled}
      activeOpacity={0.8}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 40,
        paddingHorizontal: 18,
        borderRadius: 9999,
        backgroundColor: bg,
        shadowColor: enabled ? colors.accent : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: enabled ? 0.4 : 0,
        shadowRadius: 14,
        elevation: enabled ? 6 : 0,
      }}
    >
      <Text
        style={{
          fontFamily: 'DMSans_500Medium',
          fontSize: 12,
          letterSpacing: 0.6,
          color: fg,
          marginRight: 6,
        }}
      >
        {label}
      </Text>
      <ArrowRight size={13} color={fg} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}
