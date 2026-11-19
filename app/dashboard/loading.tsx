import styles from "./dashboard.module.css";

export default function DashboardLoading() {
  return (
    <main
      className={`${styles.shell} ${styles.main}`}
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <p role="status">Loading your dashboard…</p>
      <div className={styles.loadingBeam} aria-hidden="true" />
      <div className={styles.grid} aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <div key={index} className={styles.loadingCard} />
        ))}
      </div>
    </main>
  );
}
