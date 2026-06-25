"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Moon, Leaf, Sprout, Snowflake, ArrowRight } from 'lucide-react';
import { motion, Variants } from 'motion/react';
import './landing.css';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const fadeUp: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.6, ease: "easeOut" }
    })
  };

  return (
    <div className="landing-container">
      {/* Navbar */}
      <nav className={`top-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-left">
          <div className="nav-brand">
            <Leaf className="nav-icon" />
            <span className="brand-text">Glacier2Gills</span>
          </div>
          <div className="nav-links">
            <Link href="/" className="nav-link active">Home</Link>
            <a href="#impact" className="nav-link">Our Impact</a>
            <a href="#about" className="nav-link">About</a>
            <a href="#blog" className="nav-link">Blog</a>
            <a href="#contact" className="nav-link">Contact</a>
          </div>
        </div>
        <div className="nav-right">
          <Link href="/app" className="predict-btn">Predict Yield</Link>
          <button className="theme-toggle" aria-label="Toggle Theme">
            <Moon size={20} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <motion.h1 
            custom={0} initial="hidden" animate="visible" variants={fadeUp}
            className="hero-title"
          >
            Protecting Our Planet's Food Security
          </motion.h1>
          <motion.p 
            custom={1} initial="hidden" animate="visible" variants={fadeUp}
            className="hero-subtitle"
          >
            Glacier2Gills is at the forefront of combating climate change's impact on global food systems. We use cutting-edge data science and big data processing to analyze climate patterns and their effects on food production and availability.
          </motion.p>
          <motion.div 
            custom={2} initial="hidden" animate="visible" variants={fadeUp}
            className="hero-actions"
          >
            <Link href="/app?mode=crops" className="btn btn-primary">Crop Yield Prediction</Link>
            <Link href="/app?mode=glaciers" className="btn btn-secondary">Glacier Prediction</Link>
          </motion.div>
        </div>
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="hero-image-wrapper"
        >
          <img src="/pexels-dawid-zawila-2151273316-32255248.jpg" alt="Crops field at sunset" className="hero-image" />
        </motion.div>
      </section>
      


      {/* Our Impact Section */}
      <section id="impact" className="impact-section">
        <h2 className="section-title">Our Impact</h2>
        <div className="tabs">
          <button className="tab active">Grid View</button>
          <button className="tab">Full View</button>
        </div>
        
        <div className="impact-grid">
          <div className="chart-card">
             <h3>Total Crops Count</h3>
             <div className="chart-placeholder">
               <img src="/pexels-dawid-zawila-2151273316-32906974.jpg" alt="Crop data 1" />
             </div>
          </div>
          <div className="chart-card">
             <h3>Area vs Pesticides and Yield</h3>
             <div className="chart-placeholder">
               <img src="/pexels-dawid-zawila-2151273316-37100583.jpg" alt="Crop data 2" />
             </div>
          </div>
          <div className="chart-card">
             <h3>Area and Average Pesticides</h3>
             <div className="chart-placeholder">
               <img src="/pexels-dawid-zawila-2151273316-32255248.jpg" alt="Crop data 3" />
             </div>
          </div>
          <div className="chart-card">
             <h3>Histogram of Average Rainfall</h3>
             <div className="chart-placeholder">
               <img src="/pexels-dawid-zawila-2151273316-32906974.jpg" alt="Crop data 4" />
             </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="about-content">
          <h2>About Glacier2Gills</h2>
          <p>
            At Glacier2Gills, we bridge the gap between climate science and global food security. 
            By leveraging advanced machine learning, satellite imagery, and environmental data, 
            we predict critical changes in both agriculture and glacial ecosystems.
          </p>
          <p>
            Our mission is to empower farmers, policymakers, and environmentalists with the tools 
            they need to make informed decisions in a rapidly changing climate. 
            Together, we can ensure a sustainable future from the highest glaciers to the deepest oceans.
          </p>
          <div className="btn btn-primary" style={{ display: 'inline-block', marginTop: '16px' }}>Learn More About Us</div>
        </div>
        <div className="about-image">
          <img src="/pexels-dawid-zawila-2151273316-32255248.jpg" alt="About Glacier2Gills" />
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="blog-section">
        <div className="blog-header">
          <h2 className="section-title">Latest Insights</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Stay updated with the latest news, research, and breakthroughs.</p>
        </div>
        <div className="blog-grid">
          <div className="blog-card">
            <img src="/pexels-dawid-zawila-2151273316-37100583.jpg" alt="Blog 1" />
            <div className="blog-card-content">
              <span className="blog-date">March 15, 2026</span>
              <h3>The Impact of Glacial Melt on Global Agriculture</h3>
              <p>How rising sea levels and changing water availability are affecting crop yields globally...</p>
            </div>
          </div>
          <div className="blog-card">
            <img src="/pexels-dawid-zawila-2151273316-32906974.jpg" alt="Blog 2" />
            <div className="blog-card-content">
              <span className="blog-date">April 02, 2026</span>
              <h3>Predicting Droughts with AI</h3>
              <p>Discover how our latest machine learning models accurately predict severe drought conditions...</p>
            </div>
          </div>
          <div className="blog-card">
            <img src="/pexels-dawid-zawila-2151273316-32255248.jpg" alt="Blog 3" />
            <div className="blog-card-content">
              <span className="blog-date">April 18, 2026</span>
              <h3>Sustainable Farming Practices for the Future</h3>
              <p>Actionable strategies to adapt to climate change and maintain crop resilience...</p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="contact-section">
        <h2 className="section-title">Get In Touch</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '40px', textAlign: 'center', maxWidth: '600px' }}>
          Have questions about our predictive models or want to partner with us? We'd love to hear from you.
        </p>
        <form className="contact-form" onSubmit={(e) => e.preventDefault()}>
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input type="text" id="name" placeholder="John Doe" />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input type="email" id="email" placeholder="john@example.com" />
          </div>
          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea id="message" placeholder="How can we help you?"></textarea>
          </div>
          <button type="submit" className="btn btn-primary" style={{ border: 'none', marginTop: '8px' }}>Send Message</button>
        </form>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="nav-brand">
              <Leaf className="nav-icon" />
              <span className="brand-text">Glacier2Gills</span>
            </div>
            <p>Empowering the future of global food security through advanced data science and climate predictive modeling.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Platform</h4>
              <Link href="/app?mode=crops">Crop Predictions</Link>
              <Link href="/app?mode=glaciers">Glacier Predictions</Link>
              <Link href="#impact">Our Impact</Link>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#about">About Us</a>
              <a href="#blog">Blog</a>
              <a href="#contact">Contact</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; {new Date().getFullYear()} Glacier2Gills. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
