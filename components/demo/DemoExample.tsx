import {
  SAMPLE_PROFILE,
  SAMPLE_RESUME,
  SAMPLE_DRAFT,
} from "@/app/demo/sample-data";

export default function DemoExample() {
  return (
    <div className="landing-demo-flow">
      <section className="landing-demo-panel" data-testid="demo-input">
        <div className="landing-demo-panel-heading">
          <span className="landing-demo-step">01</span>
          <div>
            <p className="landing-demo-eyebrow">Context you select</p>
            <h2>The starting point.</h2>
          </div>
        </div>

        <div className="landing-demo-profile">
          <p className="landing-demo-field-label">Illustrative profile</p>
          <h3>{SAMPLE_PROFILE.name}</h3>
          <p>{SAMPLE_PROFILE.headline}</p>
          <p className="landing-demo-location">{SAMPLE_PROFILE.location}</p>
          <p className="landing-demo-about">{SAMPLE_PROFILE.about}</p>
          <p className="landing-demo-field-label landing-demo-field-spaced">
            Recent post
          </p>
          <blockquote>“{SAMPLE_PROFILE.recentPost}”</blockquote>
        </div>

        <div className="landing-demo-resume">
          <p className="landing-demo-field-label">Your resume snippet</p>
          <p>{SAMPLE_RESUME}</p>
        </div>
      </section>

      <section
        className="landing-demo-panel landing-demo-output"
        data-testid="demo-output"
      >
        <div className="landing-demo-panel-heading">
          <span className="landing-demo-step">02</span>
          <div>
            <p className="landing-demo-eyebrow">Draft to review</p>
            <h2>Made to be yours.</h2>
          </div>
        </div>
        <p className="landing-demo-field-label">
          Illustrative connection note · {SAMPLE_DRAFT.character_count}{" "}
          characters
        </p>
        <blockquote data-testid="demo-draft" className="landing-demo-draft">
          {SAMPLE_DRAFT.body}
        </blockquote>
        <p className="landing-demo-review">
          <span aria-hidden="true">↗</span> Fictional example · review and edit
          before using
        </p>
      </section>
    </div>
  );
}
