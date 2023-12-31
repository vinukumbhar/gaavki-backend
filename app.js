  const express = require('express');
  const bodyParser = require('body-parser');
  const mysql = require('mysql');
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const nodemailer = require('nodemailer');

  const app = express();
  const port = 3001;

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); // Replace * with your allowed origins
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.use(bodyParser.json());

  const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'gaavki',
    port: 3306
  });

  connection.connect((err) => {
    if (err) {
      console.error('Error connecting to the database: ' + err.stack);
      return;
    }
    console.log('Connected to the database as id ' + connection.threadId);
  });

  app.post('/process-form', (req, res) => {
    const { name, email, phone, className, divisionName, rollno } = req.body;
    const daysBefore = req.body.days_before.toString()
    console.log(req.body)

    // Insert student data into the students table
    const insertStudentQuery = `INSERT INTO students (name, class, division_name, rollno) VALUES ("${name}", "${className}", "${divisionName}","${rollno}")`;

    connection.query(insertStudentQuery, (error, studentResult) => {
      if (error) {
        console.error('Error inserting student data: ' + error.message);
        res.status(500).json({ error: 'An error occurred while processing the form.' });
        return;
      }

      const studentId = studentResult.insertId;

      // Generate PDF certificate
      const pdfDoc = new PDFDocument();
      const certificatePath = `./certificates/certificate_${studentId}.pdf`; // Adjust the path as needed

      pdfDoc.pipe(fs.createWriteStream(certificatePath));
      const width = pdfDoc.page.width;
      const height = pdfDoc.page.height;
      const backgroundImagePath = 'background.jpg'; // Adjust the path to your image
    pdfDoc.image(backgroundImagePath, 0, 0, { width, height });
    pdfDoc.moveTo(0, 400);
      pdfDoc.fontSize(32).text(`Certificate of Completion`, { align: 'center', y: 400 });
      pdfDoc.moveTo(0, 450);
      pdfDoc.fontSize(12).text(`This is to certify that`, { align: 'center', y:450 });
      pdfDoc.moveTo(0, 500);
      pdfDoc.fontSize(16).text(name, { align: 'center', y:500 });
      // ... add more content to the certificate ...

      pdfDoc.end();

      // Insert certificate data into the certificates table
      const insertCertificateQuery = `INSERT INTO certificates (name, email, phone, student_id, days_before) VALUES ("${name}", "${email}", "${phone}", "${studentId}", ${daysBefore})`;

      connection.query(insertCertificateQuery, [name, email, phone, studentId], (error, certificateResult) => {
        if (error) {
          console.error('Error inserting certificate data: ' + error.message);
          res.status(500).json({ error: 'An error occurred while processing the form.' });
          return;
        }

        const certificateId = certificateResult.insertId;

        const transporter = nodemailer.createTransport({
          host: "smtp-mail.outlook.com",
          port: 587,
          auth: {
            user: 'atllabs@outlook.com', // Replace with your Gmail email
            pass: 'ATL@4321' // Replace with your Gmail password or app-specific password
          }
        });
      
        const mailOptions = {
          from: 'atllabs@outlook.com', // Replace with your Gmail email
          to: email,
          subject: 'Certificate of Completion',
          text: `Dear ${name},\n\nWe are pleased to provide you with the attached certificate of completion.\n\nBest regards,\nThe Certificate Team`,
          attachments: [
            {
              filename: `certificate_${studentId}.pdf`, // Adjust the filename as needed
              path: certificatePath // Provide the path to the generated PDF certificate
            }
          ]
        };
      
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Error sending email: ' + error.message);
          } else {
            console.log('Email sent: ' + info.response);
          }
        });
        res.json({ certificate_url: certificatePath, id: certificateId });
      });
    });
  });

  app.get('/mark-despatched/:id', (req, res) => {
    const certificateId = req.params.id;
    const updateQuery = 'UPDATE certificates SET despatched = true WHERE id = ?';
  
    connection.query(updateQuery, [certificateId], (error, results) => {
      if (error) {
        console.error('Error marking certificate as despatched: ' + error.message);
        res.status(500).json({ error: 'An error occurred while marking the certificate as despatched.' });
        return;
      }
  
      if (results.affectedRows === 0) {
        res.status(404).json({ error: 'Certificate not found.' });
        return;
      }
  
      res.json({ message: 'Certificate marked as despatched.' });
    });
  });


  app.get('/stats', (req, res) => {
    const queryTotal = 'SELECT COUNT(*) AS total FROM certificates';
    const querydespatched = 'SELECT COUNT(*) AS despatched FROM certificates WHERE despatched = true';
  
    connection.query(queryTotal, (errorTotal, resultsTotal) => {
      if (errorTotal) {
        console.error('Error querying total certificates: ' + errorTotal.message);
        res.status(500).json({ error: 'An error occurred while querying the statistics.' });
        return;
      }
  
      connection.query(querydespatched, (errordespatched, resultsDespatched) => {
        if (errordespatched) {
          console.error('Error querying despatched certificates: ' + errordespatched.message);
          res.status(500).json({ error: 'An error occurred while querying the statistics.' });
          return;
        }
  
        const total = +resultsTotal[0].total;
        const despatched = +resultsDespatched[0].despatched;
  
        const stats = {
          b: total,
          d: despatched
        };
  
        res.json(stats);
        console.log(stats)
      });
    });
  });

  app.get('/search/:search', (req, res) => {
    const searchQuery = req.params.search;
    const searchSQL = `
      SELECT * FROM certificates
      WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR student_id LIKE ?
    `;
  
    const searchParams = Array(4).fill(`%${searchQuery}%`); // Wildcard search with % before and after the query
  
    connection.query(searchSQL, searchParams, (error, results) => {
      if (error) {
        console.error('Error searching for certificates: ' + error.message);
        res.status(500).json({ error: 'An error occurred while searching for certificates.' });
        return;
      }
  
      res.json(results);
    });
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });







  // const express = require('express');
  // const bodyParser = require('body-parser');
  // const PDFDocument = require('pdfkit');
  // const fs = require('fs');
  // const nodemailer = require('nodemailer');
  
  // const app = express();
  // const port = 3001;
  
  // app.use((req, res, next) => {
  //   res.setHeader('Access-Control-Allow-Origin', '*'); // Replace * with your allowed origins
  //   res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  //   res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  //   next();
  // });
  
  // app.use(bodyParser.json());
  
  // app.post('/process-form', (req, res) => {
  //   const { name, email, phone } = req.body;
  //   console.log(req.body);
  
  //   // Generate PDF certificate
  //   const pdfDoc = new PDFDocument();
  //   const certificatePath = `./certificates/certificate_${name}.pdf`; // Adjust the path as needed
  
  //   pdfDoc.pipe(fs.createWriteStream(certificatePath));
  //   const width = pdfDoc.page.width;
  //   const height = pdfDoc.page.height;
  //   const backgroundImagePath = 'background.jpg'; // Adjust the path to your image
  //   pdfDoc.image(backgroundImagePath, 0, 0, { width, height });
  //   pdfDoc.moveTo(0, 400);
  //   pdfDoc.fontSize(32).text(`Certificate of Completion`, { align: 'center', y: 400 });
  //   pdfDoc.moveTo(0, 450);
  //   pdfDoc.fontSize(12).text(`This is to certify that`, { align: 'center', y: 450 });
  //   pdfDoc.moveTo(0, 500);
  //   pdfDoc.fontSize(16).text(name, { align: 'center', y: 500 });
  //   // ... add more content to the certificate ...
  
  //   pdfDoc.end();
  
  //   const transporter = nodemailer.createTransport({
  //     host: "smtp-mail.outlook.com",
  //     port: 587,
  //     auth: {
  //       user: 'atllabs@outlook.com', // Replace with your email
  //       pass: 'ATL@4321' // Replace with your password or app-specific password
  //     }
  //   });
  
  //   const mailOptions = {
  //     from: 'atllabs@outlook.com', // Replace with your email
  //     to: email,
  //     subject: 'Certificate of Completion',
  //     text: `Dear ${name},\n\nWe are pleased to provide you with the attached certificate of completion.\n\nBest regards,\nThe Certificate Team`,
  //     attachments: [
  //       {
  //         filename: `certificate_${name}.pdf`, // Adjust the filename as needed
  //         path: certificatePath // Provide the path to the generated PDF certificate
  //       }
  //     ]
  //   };
  
  //   transporter.sendMail(mailOptions, (error, info) => {
  //     if (error) {
  //       console.error('Error sending email: ' + error.message);
  //     } else {
  //       console.log('Email sent: ' + info.response);
  //     }
  //   });
  //   res.json({ certificate_url: certificatePath });
  // });
  
  // app.listen(port, () => {
  //   console.log(`Server is running on port ${port}`);
  // });
  