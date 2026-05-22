/**
 * Редактор кейса — создание и правка. Один длинный лист секций по блокам
 * кейса (brandbook §5: ширина 880px, 64px между секциями). Валидацию по
 * схеме делает Content; ошибки показываем человеку списком.
 *
 * Доступ пока открыт по прямой ссылке. Когда подключим роли (Identity),
 * раздел станет виден только администраторам/авторам.
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, Warning } from "@phosphor-icons/react";

import {
  type CatalogItem,
  ApiError,
  createCase,
  getFullCase,
  listCatalog,
  publishCase,
  updateCase,
  type ValidationProblem,
} from "@/lib/api";
import { type ClinicalCase, blankCase } from "@/lib/case";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import {
  MetadataSection,
  DiagnosisSection,
  PatientSection,
  PresentationSection,
} from "@/components/editor/BasicsSections";
import {
  FactsSection,
  OrdersSection,
  GoldStandardSection,
} from "@/components/editor/EvidenceSections";
import {
  DifferentialSection,
  TreatmentSection,
  HarmfulTreatmentSection,
  WeightsSection,
} from "@/components/editor/OutcomeSections";
import { DynamicsSection } from "@/components/editor/DynamicsSection";

const STATUS_LABEL = {
  draft: "Черновик",
  review: "На проверке",
  published: "Опубликован",
} as const;

export function EditorPage() {
  const { caseId, version } = useParams();
  const navigate = useNavigate();
  const isNew = !caseId;

  const [value, setValue] = useState<ClinicalCase | null>(isNew ? blankCase() : null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [problems, setProblems] = useState<ValidationProblem[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    listCatalog().then(({ items }) => setCatalog(items)).catch(() => setCatalog([]));
  }, []);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    getFullCase(caseId!, version ? Number(version) : undefined)
      .then((c) => !cancelled && setValue(c))
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiError ? err.detail : "Не удалось загрузить кейс.");
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, version, isNew]);

  if (loadError) {
    return <CenteredError detail={loadError} />;
  }
  if (!value) {
    return <p className="text-[color:var(--color-ink-muted)]">Загрузка…</p>;
  }

  const patch = (p: Partial<ClinicalCase>) => setValue((c) => (c ? { ...c, ...p } : c));
  const status = value.metadata.status;
  const isPublished = status === "published";

  async function handleSave() {
    if (!value || saving) return;
    setSaving(true);
    setSaveError(null);
    setProblems([]);
    try {
      const card = isNew
        ? await createCase(value)
        : await updateCase(caseId!, Number(version), value);
      setSavedAt(Date.now());
      // После создания/новой версии переходим на устойчивый адрес версии.
      navigate(`/editor/${card.id}/${card.version}`, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setSaveError(err.detail);
        if (err.validation) setProblems(err.validation);
      } else {
        setSaveError("Не удалось сохранить кейс.");
      }
    } finally {
      setSaving(false);
    }
  }

  /** Создать новую (черновую) версию из опубликованной. */
  async function handleNewVersion() {
    if (!value || saving) return;
    setSaving(true);
    setSaveError(null);
    setProblems([]);
    try {
      const card = await createCase(value);
      navigate(`/editor/${card.id}/${card.version}`, { replace: true });
    } catch (err: unknown) {
      setSaveError(err instanceof ApiError ? err.detail : "Не удалось создать версию.");
      if (err instanceof ApiError && err.validation) setProblems(err.validation);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!value || saving || isNew) return;
    setSaving(true);
    setSaveError(null);
    try {
      const card = await publishCase(caseId!, Number(version));
      patch({ metadata: { ...value.metadata, status: card.status } });
    } catch (err: unknown) {
      setSaveError(err instanceof ApiError ? err.detail : "Не удалось опубликовать кейс.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[var(--container-editor)] pb-24">
      {/* Шапка-действия */}
      <div className="sticky top-14 z-[5] -mx-6 px-6 py-3 mb-10 bg-[color:var(--color-canvas)]/90 backdrop-blur-sm border-b border-[color:var(--color-border)] flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/editor")}
          className="grid place-items-center size-9 rounded-md text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-surface-sunk)] transition-colors"
          aria-label="К списку кейсов"
        >
          <ArrowLeft weight="bold" size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate text-[color:var(--color-ink)]">
              {isNew ? "Новый кейс" : value.metadata.title || "Без названия"}
            </span>
            <Tag tone={isPublished ? "normal" : "neutral"}>{STATUS_LABEL[status]}</Tag>
          </div>
          {savedAt && !saveError && (
            <span className="text-xs text-[color:var(--color-ink-faint)] flex items-center gap-1">
              <CheckCircle weight="fill" size={12} /> Сохранено
            </span>
          )}
        </div>
        {isPublished ? (
          <Button variant="secondary" size="sm" onClick={handleNewVersion} disabled={saving}>
            Создать новую версию
          </Button>
        ) : (
          <>
            {!isNew && (
              <Button variant="secondary" size="sm" onClick={handlePublish} disabled={saving}>
                Опубликовать
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Сохранение…" : isNew ? "Создать кейс" : "Сохранить"}
            </Button>
          </>
        )}
      </div>

      {saveError && <SaveError detail={saveError} problems={problems} />}

      <h1 className="text-[length:var(--text-display-1)] leading-[var(--text-display-1--line-height)] text-[color:var(--color-ink)] mb-12">
        {isNew ? "Новый клинический кейс" : "Правка кейса"}
      </h1>

      <div className="space-y-16">
        <MetadataSection value={value} patch={patch} isNew={isNew} />
        <DiagnosisSection value={value} patch={patch} />
        <PatientSection value={value} patch={patch} />
        <PresentationSection value={value} patch={patch} />
        <FactsSection value={value} patch={patch} />
        <OrdersSection value={value} patch={patch} catalog={catalog} />
        <GoldStandardSection value={value} patch={patch} catalog={catalog} />
        <DifferentialSection value={value} patch={patch} />
        <TreatmentSection value={value} patch={patch} />
        <HarmfulTreatmentSection value={value} patch={patch} />
        <DynamicsSection value={value} patch={patch} />
        <WeightsSection value={value} patch={patch} />
      </div>

      {isPublished && (
        <p className="mt-12 text-sm text-[color:var(--color-ink-muted)] bg-[color:var(--color-surface-sunk)] rounded-md p-4">
          Это опубликованная версия — её менять нельзя. Чтобы внести правки,
          создайте новую версию.
        </p>
      )}
    </div>
  );
}

function SaveError({ detail, problems }: { detail: string; problems: ValidationProblem[] }) {
  return (
    <div className="mb-8 rounded-lg border border-[color:var(--color-critical-bg)] bg-[color:var(--color-critical-bg)]/40 p-4">
      <div className="flex items-start gap-3">
        <Warning weight="bold" size={20} className="text-[color:var(--color-critical-ink)] mt-0.5 shrink-0" />
        <div className="space-y-2">
          <p className="font-medium text-[color:var(--color-ink)]">{detail}</p>
          {problems.length > 0 && (
            <ul className="text-sm text-[color:var(--color-ink-muted)] space-y-1 list-disc pl-4">
              {problems.map((p, i) => (
                <li key={i}>
                  <span className="font-mono text-xs">{p.field}</span> — {p.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CenteredError({ detail }: { detail: string }) {
  return (
    <div className="mx-auto max-w-[var(--container-editor)] py-16 text-center space-y-3">
      <Warning weight="bold" size={32} className="mx-auto text-[color:var(--color-ink-faint)]" />
      <p className="text-[color:var(--color-ink-muted)]">{detail}</p>
    </div>
  );
}
