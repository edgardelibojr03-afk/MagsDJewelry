import { Link } from "react-router-dom"

export default function AboutUs() {
  return (
    <section className="py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">About Us</h1>
          <p className="mt-2 text-gray-600">A little story behind Mag&apos;s D. Jewelry</p>
        </header>

        <article className="bg-white rounded-lg shadow p-6 md:p-8 space-y-6">
          <p className="text-gray-700 leading-relaxed">
            At <span className="font-semibold text-gray-900">Mag&apos;s D. Jewelry</span>, we believe jewelry should be more than just an accessory—it should
            be a reflection of personal style and meaningful moments.
          </p>
          <p className="text-gray-700 leading-relaxed">
            What started as a passion for making timeless designs accessible has grown into a trusted retailer of carefully
            selected pieces. We source from reliable stores and suppliers, ensuring every item blends quality, elegance, and affordability.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Our mission is simple: to bring sophistication and beauty into everyday life without compromise. Whether you&apos;re searching for a classic piece,
            a modern design, or a gift that speaks from the heart, Mag&apos;s D. Jewelry is here to make your moments shine.
          </p>

          <div className="pt-4">
            <Link
              to="/account"
              className="inline-block px-5 py-2.5 rounded-md bg-black text-white hover:bg-gray-800 transition"
            >
              Join Us
            </Link>
          </div>
        </article>
      </div>
    </section>
  )
}