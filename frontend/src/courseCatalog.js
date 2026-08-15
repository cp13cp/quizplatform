export const courseCatalog = [
  {
    slug: "mern-stack",
    title: "MERN Stack Development",
    shortTitle: "MERN Stack",
    overview: "Build modern, full-stack web applications from interface to deployment.",
    modules: ["JavaScript and modern web foundations", "React UI development", "Node.js and Express APIs", "MongoDB, authentication, and deployment"],
  },
  {
    slug: "python-full-stack",
    title: "Python Full Stack Development",
    shortTitle: "Python Full Stack",
    overview: "Learn to create reliable web applications with Python on the backend.",
    modules: ["Python programming and web foundations", "Frontend with HTML, CSS, and JavaScript", "Django and REST API development", "Databases, authentication, and deployment"],
  },
  {
    slug: "artificial-intelligence",
    title: "Artificial Intelligence",
    shortTitle: "AI",
    overview: "Build practical AI skills with Python, machine learning, and generative AI.",
    modules: ["Python for data and AI", "Machine learning fundamentals", "NLP and generative AI applications", "Model projects and deployment basics"],
  },
];

export const courseDetails = {
  fee: "₹9,999",
  duration: "4 months",
  schedule: "Monday to Friday, 1.5 hours daily",
  whatsappNumber: "919399693204",
};

export function courseWhatsAppLink(course) {
  const message = `Hello Track4u, I want to buy the ${course.title} live course for ${courseDetails.fee}.`;
  return `https://wa.me/${courseDetails.whatsappNumber}?text=${encodeURIComponent(message)}`;
}
