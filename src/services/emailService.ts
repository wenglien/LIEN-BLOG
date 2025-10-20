export interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  topic: string;
  message: string;
}

// Send email using EmailJS
export const sendContactEmail = async (formData: ContactFormData): Promise<boolean> => {
  try {
    // Dynamically import EmailJS
    const emailjs = await import('@emailjs/browser');

    // EmailJS Configuration
    const serviceId = 'service_2ozestk';
    const templateId = 'template_jtswk5h';
    const publicKey = 'xAv0xRv7IZ_u09dr2';

    // Initialize EmailJS
    emailjs.init(publicKey);

    // Prepare template parameters
    const templateParams = {
      from_name: formData.name,
      from_email: formData.email,
      phone: formData.phone,
      topic: formData.topic,
      message: formData.message,
      to_email: 'ian921030@gmail.com',
      reply_to: formData.email,
    };

    // Send email
    const response = await emailjs.send(
      serviceId,
      templateId,
      templateParams
    );

    console.log('Email sent successfully via EmailJS:', response);
    return true;
  } catch (error) {
    console.error('Failed to send email via EmailJS:', error);
    return false;
  }
};

// Fallback: Use EmailJS
export const sendContactEmailFallback = async (_formData: ContactFormData): Promise<boolean> => {
  try {
    // Implement fallback here
    // Currently return false to let main solution handle it
    return false;
  } catch (error) {
    console.error('Failed to send email via fallback:', error);
    return false;
  }
};
