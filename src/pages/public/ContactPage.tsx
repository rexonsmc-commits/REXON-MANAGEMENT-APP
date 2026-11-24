import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { PublicLayout } from '../../components/layout/PublicLayout';
import { submitContactMessage } from '../../services/subscriptions/subscriptionService';

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your full name').max(120),
  companyName: z.string().max(160).optional(),
  email: z.string().email('Please enter a valid work email').max(160),
  phone: z.string().min(5, 'Please enter a valid contact number').max(40),
  subject: z.string().min(2, 'Please enter a subject').max(160),
  message: z.string().min(10, 'Please describe your inquiry (at least 10 characters)').max(2000),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get('plan');
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      subject: initialPlan ? `Organization Onboarding Inquiry — ${initialPlan} Plan` : '',
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    setSubmitError(null);
    try {
      await submitContactMessage({
        name: values.name,
        companyName: values.companyName || '',
        email: values.email,
        phone: values.phone,
        subject: values.subject,
        message: values.message,
      });
      setSubmitted(true);
      reset();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? 'Unable to submit your inquiry right now. Please verify your connection and try again.'
          : 'Submission failed.'
      );
    }
  };

  return (
    <PublicLayout>
      <section className="border-b border-slate-200 bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wide text-[#1D4ED8]">Contact Us</p>
            <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-slate-900">
              Request Organization Provisioning or Platform Support
            </h1>
            <p className="mt-4 text-base text-slate-600">
              Submit your organization details to schedule onboarding or inquire about subscription
              activation. Inquiries are stored securely in Firestore for Super Admin review.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
          {/* Contact Information Placeholders (No invented fake addresses/phones) */}
          <div className="space-y-6 lg:col-span-5">
            <div className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Corporate Contact Channels
              </h2>
              <p className="mt-2 text-xs text-slate-500">
                Placeholder values displayed until official corporate contact details are finalized.
              </p>

              <div className="mt-6 space-y-5 text-sm">
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]" />
                  <div>
                    <p className="font-semibold text-slate-900">Organization Name</p>
                    <p className="text-slate-600">REXON MANAGEMENT APP</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]" />
                  <div>
                    <p className="font-semibold text-slate-900">Registered Office Address</p>
                    <p className="text-slate-600">
                      Placeholder — Official registered office address to be configured
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]" />
                  <div>
                    <p className="font-semibold text-slate-900">Contact Phone</p>
                    <p className="text-slate-600">
                      Placeholder — Official support phone number to be configured
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#1D4ED8]" />
                  <div>
                    <p className="font-semibold text-slate-900">Onboarding Inquiries</p>
                    <p className="text-slate-600">
                      Submit via the validated form on this page for direct Super Admin review
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Validated Inquiry Form */}
          <div className="lg:col-span-7">
            <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
              {submitted ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                  <h2 className="mt-4 font-display text-2xl font-bold text-slate-900">
                    Inquiry Submitted Successfully
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Your message has been logged in our system. An authorized Super Admin
                    representative will review your request.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-6 rounded-lg bg-[#1D4ED8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1E40AF]"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    Send an Inquiry
                  </h2>

                  {submitError && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                      {submitError}
                    </div>
                  )}

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        {...register('name')}
                        placeholder="Enter your name"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.name && (
                        <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">
                        Company / Society / Factory Name
                      </label>
                      <input
                        type="text"
                        {...register('companyName')}
                        placeholder="Organization name"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Email *</label>
                      <input
                        type="email"
                        {...register('email')}
                        placeholder="you@organization.com"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700">Phone *</label>
                      <input
                        type="tel"
                        {...register('phone')}
                        placeholder="Contact number"
                        className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-rose-600">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Subject *</label>
                    <input
                      type="text"
                      {...register('subject')}
                      placeholder="e.g., Organization Onboarding for 3 Residential Towers"
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                    {errors.subject && (
                      <p className="mt-1 text-xs text-rose-600">{errors.subject.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Message *</label>
                    <textarea
                      rows={4}
                      {...register('message')}
                      placeholder="Share your organization type, site count, and onboarding requirements..."
                      className="mt-1.5 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:border-[#1D4ED8] focus:outline-none"
                    />
                    {errors.message && (
                      <p className="mt-1 text-xs text-rose-600">{errors.message.message}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-lg bg-[#1D4ED8] px-6 py-3 text-sm font-semibold text-white hover:bg-[#1E40AF] transition-colors disabled:opacity-60 sm:w-auto"
                  >
                    {isSubmitting ? 'Submitting Inquiry...' : 'Submit Inquiry'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
