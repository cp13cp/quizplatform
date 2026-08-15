import { Link } from "react-router-dom";
import { courseCatalog, courseDetails, courseWhatsAppLink } from "../courseCatalog.js";

export default function Courses() {
  return (
    <section className="courses-page">
      <div className="courses-inner">
        <div className="courses-heading">
          <p className="section-kicker">Live instructor-led programs</p>
          <h1>Choose Your Career Track</h1>
          <p>Build in-demand skills with structured live classes and practical guidance.</p>
        </div>

        <div className="course-grid">
          {courseCatalog.map((course) => (
            <article className="course-card" key={course.slug}>
              <span className="course-live-label">Live course</span>
              <h2>{course.title}</h2>
              <p className="course-overview">{course.overview}</p>
              <div className="course-facts">
                <span><strong>Duration</strong>{courseDetails.duration}</span>
                <span><strong>Class time</strong>{courseDetails.schedule}</span>
              </div>
              <div className="course-price">
                <span>Course fee</span>
                <strong>{courseDetails.fee}</strong>
              </div>
              <div className="course-actions">
                <Link className="course-details-link" to={`/courses/${course.slug}`}>View details</Link>
                <a className="course-buy-link" href={courseWhatsAppLink(course)} target="_blank" rel="noreferrer">Buy on WhatsApp</a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
