import type { Ownership, ProductQuestion, ProductAnswer, User } from '@prisma/client';
import type { QuestionDto, AnswerDto, QuickAnswer } from '@wudly/shared';

type AnswerWithAuthor = ProductAnswer & {
  answeredBy: Pick<User, 'id' | 'displayName' | 'role'> | null;
  ownership: Pick<Ownership, 'verificationStatus' | 'createdAt'> | null;
};

export type QuestionWithRelations = ProductQuestion & {
  askedBy: Pick<User, 'id' | 'displayName'> | null;
  answers: AnswerWithAuthor[];
};

export function toAnswerDto(answer: AnswerWithAuthor): AnswerDto {
  return {
    id: answer.id,
    questionId: answer.questionId,
    answeredByUserId: answer.answeredByUserId,
    authorName: answer.answeredBy?.displayName ?? null,
    authorType: answer.ownership
      ? 'OWNER'
      : answer.answeredBy?.role === 'ADMIN'
        ? 'WUDLY_TEAM'
        : 'COMMUNITY',
    verificationStatus: answer.ownership?.verificationStatus ?? null,
    ownerSince: answer.ownership?.createdAt.toISOString() ?? null,
    answerText: answer.answerText,
    quickAnswer: (answer.quickAnswer as QuickAnswer | null) ?? null,
    helpfulCount: answer.helpfulCount,
    createdAt: answer.createdAt.toISOString(),
  };
}

export function toQuestionDto(question: QuestionWithRelations, ownerCount = 0): QuestionDto {
  const answers = [...question.answers]
    .sort((a, b) => b.helpfulCount - a.helpfulCount || +a.createdAt - +b.createdAt)
    .map(toAnswerDto);
  return {
    id: question.id,
    productId: question.productId,
    askedByUserId: question.askedByUserId,
    authorName: question.askedBy?.displayName ?? null,
    questionText: question.questionText,
    status: question.status,
    answers,
    answerCount: answers.length,
    ownerCount,
    createdAt: question.createdAt.toISOString(),
  };
}
