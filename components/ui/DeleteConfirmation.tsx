"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import gsap from "gsap";
import styles from "./delete-confirmation.module.css";

const HOLD_MS = 1200;
const holdKeys = ["Enter", " "];

type Input = { pointerId: number } | { key: string };
type Hold = { input: Input; timer: number; listeners: AbortController };

export default function DeleteConfirmation({
  kind,
  name,
  disabled = false,
  onConfirm,
}: {
  kind: "evidence" | "résumé";
  name: string;
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const hold = useRef<Hold | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const submitting = useRef(false);
  const [holding, setHolding] = useState(false);
  const [clickConfirmation, setClickConfirmation] = useState(false);

  useEffect(() => {
    return () => {
      const active = hold.current;
      if (active) {
        window.clearTimeout(active.timer);
        active.listeners.abort();
        hold.current = null;
      }
      tween.current?.kill();
    };
  }, []);

  function stopHold() {
    const active = hold.current;
    if (!active) return;
    hold.current = null;
    window.clearTimeout(active.timer);
    active.listeners.abort();
    tween.current?.kill();
    if (fill.current) {
      tween.current = gsap.to(fill.current, {
        scaleX: 0,
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 0.2,
        ease: "power2.out",
      });
    }
    setHolding(false);
  }

  async function confirm() {
    if (
      !dialog.current?.open ||
      trigger.current?.disabled ||
      submitting.current
    )
      return;
    submitting.current = true;
    stopHold();
    dialog.current.close();
    try {
      await onConfirm();
    } finally {
      submitting.current = false;
    }
  }

  function startHold(input: Input) {
    if (hold.current || submitting.current || trigger.current?.disabled) return;
    const listeners = new AbortController();
    const timer = window.setTimeout(() => {
      if (
        document.hidden ||
        document.activeElement !== confirmButton.current ||
        trigger.current?.disabled ||
        !dialog.current?.open
      ) {
        stopHold();
        return;
      }
      void confirm();
    }, HOLD_MS);
    hold.current = { input, timer, listeners };
    window.addEventListener("blur", stopHold, { signal: listeners.signal });
    document.addEventListener("visibilitychange", stopHold, {
      signal: listeners.signal,
    });

    setHolding(true);
    tween.current?.kill();
    if (
      fill.current &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      tween.current = gsap.fromTo(
        fill.current,
        { scaleX: 0 },
        { scaleX: 1, duration: HOLD_MS / 1000, ease: "none" },
      );
    }
  }

  function close() {
    stopHold();
    dialog.current?.close();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label={`Delete ${name}`}
        aria-haspopup="dialog"
        disabled={disabled}
        onClick={() => {
          if (submitting.current) return;
          setClickConfirmation(false);
          dialog.current?.showModal();
        }}
      >
        <Trash2 size={15} aria-hidden="true" />
        Delete
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={stopHold}
        onClose={() => {
          if (!dialog.current?.open) stopHold();
        }}
      >
        <h2 id={titleId}>Delete {kind}?</h2>
        <p className={styles.item}>{name}</p>
        <p id={descriptionId}>This permanently deletes the saved {kind}.</p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancel}
            autoFocus
            onClick={close}
          >
            Cancel
          </button>
          <button
            ref={confirmButton}
            type="button"
            className={styles.confirm}
            disabled={disabled}
            data-holding={holding}
            onClick={clickConfirmation ? () => void confirm() : undefined}
            onBlur={stopHold}
            onPointerDown={(event) => {
              if (
                clickConfirmation ||
                !event.isPrimary ||
                event.button !== 0 ||
                hold.current
              )
                return;
              event.currentTarget.focus();
              event.currentTarget.setPointerCapture(event.pointerId);
              startHold({ pointerId: event.pointerId });
            }}
            onPointerMove={(event) => {
              const input = hold.current?.input;
              if (
                !input ||
                !("pointerId" in input) ||
                input.pointerId !== event.pointerId
              )
                return;
              const rect = event.currentTarget.getBoundingClientRect();
              if (
                (event.buttons & 1) === 0 ||
                event.clientX < rect.left - 8 ||
                event.clientX > rect.right + 8 ||
                event.clientY < rect.top - 8 ||
                event.clientY > rect.bottom + 8
              )
                stopHold();
            }}
            onPointerUp={(event) => {
              const input = hold.current?.input;
              if (
                input &&
                "pointerId" in input &&
                input.pointerId === event.pointerId
              )
                stopHold();
            }}
            onPointerCancel={stopHold}
            onLostPointerCapture={stopHold}
            onKeyDown={(event) => {
              if (!holdKeys.includes(event.key)) return;
              // A held Enter can outlive the focus change between confirmation steps.
              if (event.repeat) {
                event.preventDefault();
                return;
              }
              if (clickConfirmation) return;
              event.preventDefault();
              startHold({ key: event.key });
            }}
            onKeyUp={(event) => {
              if (clickConfirmation || !holdKeys.includes(event.key)) return;
              event.preventDefault();
              const input = hold.current?.input;
              if (input && "key" in input && input.key === event.key)
                stopHold();
            }}
            onContextMenu={(event) => {
              if (!clickConfirmation) event.preventDefault();
            }}
          >
            <span ref={fill} className={styles.fill} aria-hidden="true" />
            <span className={styles.label}>
              {clickConfirmation ? "Delete permanently" : "Hold to delete"}
            </span>
          </button>
        </div>
        {!clickConfirmation && (
          <button
            type="button"
            className={styles.alternative}
            onClick={() => {
              stopHold();
              setClickConfirmation(true);
              confirmButton.current?.focus();
            }}
          >
            Confirm without holding
          </button>
        )}
      </dialog>
    </>
  );
}
