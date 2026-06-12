import { useState } from 'react';
import { reportQuestion, type Question, type AnswerResponse } from '../api';

interface Props {
  question: Question;
  onAnswer: (selectedIndex: number) => Promise<AnswerResponse>;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
  currentIndex: number;
  total: number;
}

export default function McqCard({
  question,
  onAnswer,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
  currentIndex,
  total,
}: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const handleSelect = async (index: number) => {
    if (result) return; // already answered
    setSelected(index);
    setSubmitting(true);
    const res = await onAnswer(index);
    setResult(res);
    setSubmitting(false);
  };

  const optionBorder = (index: number) => {
    if (!result) {
      return selected === index
        ? 'border-[#722F37] bg-[#722F37]/5'
        : 'border-[#E5E0DA] hover:border-[#C8A951]';
    }
    if (index === result.correct_index) return 'border-[#2D6A4F] bg-[#2D6A4F]/10';
    if (index === selected && !result.is_correct) return 'border-[#C13838] bg-[#C13838]/10';
    return 'border-[#E5E0DA] opacity-50';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#E5E0DA] p-6">
      {/* Progress bar */}
      <div className="flex items-center gap-2 text-sm text-[#6B6B6B] mb-4">
        <span>
          Question {currentIndex + 1} of {total}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          question.level === 'L1' ? 'bg-green-100 text-green-700' :
          question.level === 'L3' ? 'bg-[#722F37]/10 text-[#722F37]' :
          'bg-amber-100 text-amber-700'
        }`}>
          {question.level || 'L2'}
        </span>
        <div className="flex-1 h-1.5 bg-[#E5E0DA] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#722F37] rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <h2 className="text-lg font-medium text-[#1A1A1A] mb-6 leading-relaxed">
        {question.text}
      </h2>

      {/* Image (label-the-diagram questions) */}
      {question.image_url && (
        <div className="mb-6">
          <img
            src={question.image_url}
            alt="Question diagram"
            className="max-w-full max-h-80 rounded-lg border border-[#E5E0DA] object-contain"
            loading="lazy"
          />
        </div>
      )}

      {/* Options */}
      <div className="space-y-3 mb-6">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(index)}
            disabled={!!result || submitting}
            className={`w-full text-left px-4 py-3.5 rounded-lg border transition-colors cursor-pointer ${optionBorder(index)}`}
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-current text-xs font-medium mr-3">
              {String.fromCharCode(65 + index)}
            </span>
            {option}
            {result && index === result.correct_index && (
              <span className="float-right text-[#2D6A4F]">✓</span>
            )}
            {result && index === selected && !result.is_correct && (
              <span className="float-right text-[#C13838]">✗</span>
            )}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {result && (
        <div
          className={`p-4 rounded-lg mb-4 ${
            result.is_correct
              ? 'bg-[#2D6A4F]/10 border border-[#2D6A4F]/30'
              : 'bg-[#C13838]/10 border border-[#C13838]/30'
          }`}
        >
          <p className={`font-medium text-sm mb-1 ${result.is_correct ? 'text-[#2D6A4F]' : 'text-[#C13838]'}`}>
            {result.is_correct ? 'Correct!' : 'Incorrect'}
          </p>
          <p className="text-sm text-[#4A4A4A] mb-2">{result.explanation}</p>
          <button
            onClick={async () => {
              try { await reportQuestion(question.id); setReported(true); } catch { /* ignore */ }
            }}
            disabled={reported}
            className="text-xs text-[#6B6B6B] hover:text-[#C13838] transition-colors cursor-pointer disabled:opacity-50"
          >
            {reported ? '✓ Reported — thank you' : 'Report an issue with this question'}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="px-4 py-2 text-sm text-[#6B6B6B] hover:text-[#722F37] disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer"
        >
          ← Previous
        </button>
        {result && (
          <button
            onClick={onNext}
            className="px-6 py-2 bg-[#722F37] text-white text-sm rounded-lg hover:bg-[#8B4550] transition-colors cursor-pointer"
          >
            {hasNext ? 'Next →' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
}
