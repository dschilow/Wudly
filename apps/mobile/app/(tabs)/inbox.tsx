import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NotificationDto, NotificationListDto, OpenQuestionDto, NotificationType } from '@wudly/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/theme/ThemeProvider';
import { QuestionCard } from '@/components/QuestionCard';
import { Button, Card, Muted } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';

const typeIcon: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  QUESTION_ASKED: 'help-circle-outline',
  QUESTION_ANSWERED: 'chatbubble-ellipses-outline',
  ANSWER_HELPFUL: 'thumbs-up-outline',
  REBUY_REMINDER: 'time-outline',
};

export default function InboxScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [data, setData] = useState<NotificationListDto | null>(null);
  const [openQuestions, setOpenQuestions] = useState<OpenQuestionDto[]>([]);
  const [myQuestions, setMyQuestions] = useState<OpenQuestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [list, open, mine] = await Promise.all([
        api.notifications.list(30),
        api.notifications.openQuestions().catch(() => []),
        api.notifications.myQuestions().catch(() => []),
      ]);
      setData(list);
      setOpenQuestions(open);
      setMyQuestions(mine);
      if (list.unreadCount > 0) void api.notifications.markAllRead().catch(() => {});
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: 16, alignItems: 'center' }}>
          <Ionicons name="notifications-outline" size={56} color={colors.accent} />
          <Text style={{ color: colors.label, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>Mitteilungen</Text>
          <Muted style={{ textAlign: 'center' }}>
            Melde dich an, um Fragen zu deinen Produkten und Antworten auf deine Fragen zu sehen.
          </Muted>
          <Button title="Anmelden" onPress={() => router.push('/login')} />
        </View>
      </SafeAreaView>
    );
  }

  const items = data?.items ?? [];
  const isEmpty = !loading && items.length === 0 && openQuestions.length === 0 && myQuestions.length === 0;

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40, gap: spacing.xl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {loading && !data ? (
          <View style={{ paddingVertical: 40, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            {myQuestions.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionLabel text={`Meine Fragen · ${myQuestions.length}`} />
                {myQuestions.map((mq) => (
                  <MyQuestionRow key={mq.question.id} item={mq} onPress={() => router.push(`/product/${mq.product.id}`)} />
                ))}
              </View>
            )}

            {openQuestions.length > 0 && (
              <View style={{ gap: 10 }}>
                <SectionLabel text={`Fragen zu deinen Produkten · ${openQuestions.length}`} />
                {openQuestions.map((oq) => (
                  <View key={oq.question.id} style={{ gap: 6 }}>
                    <Pressable
                      onPress={() => router.push(`/product/${oq.product.id}`)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Ionicons name="cube-outline" size={14} color={colors.mutedForeground} />
                      <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 13, flex: 1 }}>
                        {oq.product.canonicalName}
                      </Text>
                    </Pressable>
                    <QuestionCard
                      question={oq.question}
                      onAnswered={() => setOpenQuestions((prev) => prev.filter((x) => x.question.id !== oq.question.id))}
                    />
                  </View>
                ))}
              </View>
            )}

            <View style={{ gap: 10 }}>
              <SectionLabel text="Aktivität" />
              {items.length > 0 ? (
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                  {items.map((n, i) => (
                    <NotificationRow key={n.id} notification={n} last={i === items.length - 1} router={router} />
                  ))}
                </Card>
              ) : (
                isEmpty && (
                  <Card>
                    <Muted style={{ textAlign: 'center' }}>
                      Wenn jemand zu deinen Produkten fragt oder deine Frage beantwortet, erscheint es hier.
                    </Muted>
                  </Card>
                )
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {text}
    </Text>
  );
}

function MyQuestionRow({ item, onPress }: { item: OpenQuestionDto; onPress: () => void }) {
  const { colors, radius } = useTheme();
  const total = item.question.ownerCount;
  const answered = Math.min(item.question.answerCount, total > 0 ? total : item.question.answerCount);
  const pct = total > 0 ? Math.round((answered / total) * 100) : answered > 0 ? 100 : 0;

  return (
    <Pressable onPress={onPress}>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="cube-outline" size={14} color={colors.mutedForeground} />
          <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 12, flex: 1 }}>
            {item.product.canonicalName}
          </Text>
        </View>
        <Text style={{ color: colors.label, fontSize: 15, fontWeight: '700' }}>{item.question.questionText}</Text>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.fill2, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: '100%', backgroundColor: colors.accent, borderRadius: 3 }} />
        </View>
        <Text style={{ color: colors.faint, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {total > 0
            ? `${answered} von ${total} ${total === 1 ? 'Besitzer hat' : 'Besitzern haben'} geantwortet`
            : item.question.answerCount > 0
              ? `${item.question.answerCount} Antworten`
              : 'Wartet auf Besitzer-Antworten'}
        </Text>
      </Card>
    </Pressable>
  );
}

function NotificationRow({
  notification,
  last,
  router,
}: {
  notification: NotificationDto;
  last: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors } = useTheme();
  const icon = typeIcon[notification.type] ?? 'notifications-outline';
  const go = () => {
    if (notification.productId) router.push(`/product/${notification.productId}`);
  };
  return (
    <Pressable
      onPress={go}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={colors.accentInk} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ flex: 1, color: colors.label, fontSize: 15, fontWeight: '600' }}>{notification.title}</Text>
          {!notification.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 }} />}
        </View>
        {notification.body && <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 2 }}>{notification.body}</Text>}
        <Text style={{ color: colors.faint, fontSize: 12, marginTop: 2 }}>{formatRelativeTime(notification.createdAt)}</Text>
      </View>
    </Pressable>
  );
}
