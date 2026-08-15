import { Link, Navigate, useParams } from "react-router-dom";
import { courseCatalog, courseDetails, courseWhatsAppLink } from "../courseCatalog.js";

export default function CourseDetails() {
  const { courseSlug } = useParams();
  const course = courseCatalog.find(({ slug }) => slug === courseSlug);

  if (!course) return <Navigate to="/courses" replace />;

  return (
    <section className="course-details-page">
      <div className="course-details-inner">
        <Link to="/courses" className="back-to-courses">Back to courses</Link>
        <div className="course-details-layout">
          <div>
            <p className="section-kicker">Live instructor-led program</p>
            <h1>{course.title}</h1>
            <p className="course-details-overview">{course.overview}</p>

            <section className="curriculum-section" aria-labelledby="curriculum-title">
              <h2 id="curriculum-title">Course Content</h2>
              <ol className="curriculum-list">
                {course.modules.map((module, index) => <li key={module}><span>{String(index + 1).padStart(2, "0")}</span>{module}</li>)}
              </ol>
            </section>
          </div>

          <aside className="course-enrollment-card">
            <span className="course-live-label">Live course</span>
            <strong className="enrollment-price">{courseDetails.fee}</strong>
            <div className="enrollment-info">
              <span><strong>Duration</strong>{courseDetails.duration}</span>
              <span><strong>Schedule</strong>{courseDetails.schedule}</span>
              <span><strong>Format</strong>Online live classes</span>
            </div>
            <a className="course-buy-link" href={courseWhatsAppLink(course)} target="_blank" rel="noreferrer">Buy on WhatsApp</a>
          </aside>
        </div>
      </div>
    </section>
  );
}
