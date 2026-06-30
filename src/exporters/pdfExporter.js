import fs from 'fs';
import PDFDocument from 'pdfkit';

/**
 * Exports a list of canonical candidate profiles to a professional PDF document.
 * @param {Array<Object>} profiles - List of canonical candidate profiles.
 * @param {string} outputPath - Output file path for the PDF.
 * @returns {Promise<void>} Resolves when the PDF write stream completes.
 */
export function exportProfilesToPDF(profiles, outputPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const writeStream = fs.createWriteStream(outputPath);
    doc.pipe(writeStream);

    profiles.forEach((profile, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // Title/Header
      doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold').text(profile.full_name || 'Unknown Candidate');
      
      // Headline (if any)
      if (profile.links && profile.links.headline) {
        doc.fillColor('#64748b').fontSize(12).font('Helvetica-Oblique').text(profile.links.headline);
        doc.moveDown(0.5);
      } else {
        doc.moveDown(0.2);
      }

      // Contact Details Row
      const contactInfo = [];
      if (profile.emails && profile.emails.length > 0) contactInfo.push(profile.emails[0]);
      if (profile.phones && profile.phones.length > 0) contactInfo.push(profile.phones[0]);
      if (profile.location) {
        const locStr = [profile.location.city, profile.location.region, profile.location.country].filter(Boolean).join(', ');
        if (locStr) contactInfo.push(locStr);
      }
      doc.fillColor('#334155').fontSize(9).font('Helvetica').text(contactInfo.join('  |  '));
      doc.moveDown(0.8);

      // Social Links Row
      const linksInfo = [];
      if (profile.links) {
        if (profile.links.linkedin) linksInfo.push(`LinkedIn: ${profile.links.linkedin}`);
        if (profile.links.github) linksInfo.push(`GitHub: ${profile.links.github}`);
        if (profile.links.portfolio) linksInfo.push(`Portfolio: ${profile.links.portfolio}`);
        if (profile.links.other && profile.links.other.length > 0) {
          profile.links.other.forEach(link => linksInfo.push(link));
        }
      }
      if (linksInfo.length > 0) {
        doc.fillColor('#0284c7').fontSize(8).font('Helvetica').text(linksInfo.slice(0, 5).join('  |  '));
        doc.moveDown(0.5);
      }

      // Section divider line
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1);

      // Metadata Info Row (Confidence)
      doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold').text(`Candidate Profile ID: `, { continued: true })
         .font('Helvetica').text(`${profile.candidate_id}   `, { continued: true })
         .font('Helvetica-Bold').text(`Confidence Score: `, { continued: true })
         .font('Helvetica').text(`${(profile.overall_confidence * 100).toFixed(0)}%`);
      doc.moveDown(1.2);

      // Skills Section
      if (profile.skills && profile.skills.length > 0) {
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('SKILLS');
        doc.moveDown(0.4);
        
        // Extract skill names (skills is array of arrays: [ [name, confidence, sources] ])
        const skillNames = profile.skills.map(s => Array.isArray(s) ? s[0] : s.name).filter(Boolean);
        doc.fillColor('#334155').fontSize(10).font('Helvetica').text(skillNames.join(', '), { width: 495, align: 'justify' });
        doc.moveDown(1.5);
      }

      // Experience/Internship Section
      if (profile.experience && profile.experience.length > 0) {
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('EXPERIENCE & INTERNSHIPS');
        doc.moveDown(0.5);

        profile.experience.forEach(job => {
          const comp = job.company || 'Unknown Company';
          const titl = job.title || 'Role';
          const dates = [job.start, job.end].filter(Boolean).join(' - ') || 'Dates N/A';

          doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(comp, { continued: true })
             .fillColor('#64748b').fontSize(10).font('Helvetica').text(`  |  ${titl} (${dates})`);
          doc.moveDown(0.2);

          if (job.summary) {
            doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(job.summary, { width: 495, align: 'left' });
          }
          doc.moveDown(0.8);
        });
        doc.moveDown(0.5);
      }

      // Personal Projects Section
      if (profile.projects && profile.projects.length > 0) {
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('PERSONAL PROJECTS');
        doc.moveDown(0.5);

        profile.projects.forEach(proj => {
          doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text(proj.name || 'Unnamed Project');
          doc.moveDown(0.2);

          if (proj.summary) {
            doc.fillColor('#334155').fontSize(9.5).font('Helvetica').text(proj.summary, { width: 495, align: 'left' });
          }
          doc.moveDown(0.8);
        });
        doc.moveDown(0.5);
      }

      // Education Section
      if (profile.education && profile.education.length > 0) {
        doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('EDUCATION');
        doc.moveDown(0.5);

        profile.education.forEach(edu => {
          const inst = edu.institution || 'Unknown Institution';
          const deg = [edu.degree, edu.field].filter(Boolean).join(' in ') || 'Degree Details';
          const year = edu.end_year ? `Graduated: ${edu.end_year}` : '';

          doc.fillColor('#0f172a').fontSize(10.5).font('Helvetica-Bold').text(inst);
          doc.fillColor('#475569').fontSize(9.5).font('Helvetica').text([deg, year].filter(Boolean).join('  |  '));
          doc.moveDown(0.6);
        });
      }
    });

    doc.end();

    writeStream.on('finish', () => {
      resolve();
    });

    writeStream.on('error', err => {
      reject(err);
    });
  });
}
