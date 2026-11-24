import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { FIELD_LIMITS } from '../../config/permissions';
import {
  AuditLog,
  ContactMessage,
  PaymentRecord,
  Subscription,
  SubscriptionPlan,
  UserProfile,
} from '../../types';
import { generateSafeId } from '../auth/authService';
import { db, handleFirestoreError, OperationType } from '../firebase/config';

// =========================================================================
// AUDIT LOGS (Append-Only)
// =========================================================================

export async function createAuditLog(
  actor: UserProfile,
  details: {
    organizationId?: string;
    action: string;
    targetCollection: string;
    targetId: string;
    summary: string;
  }
): Promise<void> {
  const id = generateSafeId('audit');
  const payload: Record<string, unknown> = {
    id,
    actorUid: actor.uid,
    actorEmail: actor.email.slice(0, FIELD_LIMITS.EMAIL_MAX),
    actorRole: actor.role,
    action: details.action.slice(0, 80),
    targetCollection: details.targetCollection.slice(0, 80),
    targetId: details.targetId.slice(0, 128),
    summary: details.summary.slice(0, 300),
    createdAt: serverTimestamp(),
  };
  if (details.organizationId) {
    payload.organizationId = details.organizationId;
  }
  try {
    await setDoc(doc(db, 'auditLogs', id), payload);
  } catch (error) {
    console.warn('Audit log write skipped or failed:', error);
  }
}

export async function listAuditLogs(organizationId?: string): Promise<AuditLog[]> {
  try {
    const q = organizationId
      ? query(collection(db, 'auditLogs'), where('organizationId', '==', organizationId))
      : collection(db, 'auditLogs');
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as AuditLog);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'auditLogs');
  }
}

// =========================================================================
// SUBSCRIPTION PLANS (Super Admin Controlled)
// =========================================================================

export async function listPublicSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const q = query(collection(db, 'subscriptionPlans'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as SubscriptionPlan);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subscriptionPlans');
  }
}

export async function listAllSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    const snap = await getDocs(collection(db, 'subscriptionPlans'));
    return snap.docs.map((d) => d.data() as SubscriptionPlan);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subscriptionPlans');
  }
}

export async function createSubscriptionPlan(
  input: Omit<SubscriptionPlan, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<SubscriptionPlan> {
  const id = generateSafeId('plan');
  const payload: Record<string, unknown> = {
    id,
    name: input.name.trim().slice(0, 100),
    description: input.description.trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
    monthlyPrice: Number(input.monthlyPrice),
    quarterlyPrice: Number(input.quarterlyPrice),
    halfYearlyPrice: Number(input.halfYearlyPrice),
    yearlyPrice: Number(input.yearlyPrice),
    features: input.features.slice(0, 20),
    maxStaff: Number(input.maxStaff),
    maxSites: Number(input.maxSites),
    status: input.status,
    createdBy: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.targetAudience) {
    payload.targetAudience = input.targetAudience.trim().slice(0, 120);
  }
  try {
    await setDoc(doc(db, 'subscriptionPlans', id), payload);
    await createAuditLog(actor, {
      action: 'CREATE_SUBSCRIPTION_PLAN',
      targetCollection: 'subscriptionPlans',
      targetId: id,
      summary: `Created subscription plan "${payload.name}"`,
    });
    return { ...(payload as unknown as SubscriptionPlan), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `subscriptionPlans/${id}`);
  }
}

export async function updateSubscriptionPlan(
  planId: string,
  updates: Partial<SubscriptionPlan>,
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'subscriptionPlans', planId));
    if (!snap.exists()) throw new Error('Plan not found');
    const cur = snap.data() as SubscriptionPlan;

    const payload: Record<string, unknown> = {
      id: cur.id,
      name: (updates.name ?? cur.name).trim().slice(0, 100),
      description: (updates.description ?? cur.description)
        .trim()
        .slice(0, FIELD_LIMITS.DESCRIPTION_MAX),
      monthlyPrice: Number(updates.monthlyPrice ?? cur.monthlyPrice),
      quarterlyPrice: Number(updates.quarterlyPrice ?? cur.quarterlyPrice),
      halfYearlyPrice: Number(updates.halfYearlyPrice ?? cur.halfYearlyPrice),
      yearlyPrice: Number(updates.yearlyPrice ?? cur.yearlyPrice),
      features: (updates.features ?? cur.features).slice(0, 20),
      maxStaff: Number(updates.maxStaff ?? cur.maxStaff),
      maxSites: Number(updates.maxSites ?? cur.maxSites),
      status: updates.status ?? cur.status,
      createdBy: cur.createdBy,
      createdAt: cur.createdAt,
      updatedAt: serverTimestamp(),
    };
    const audience = updates.targetAudience ?? cur.targetAudience;
    if (audience) payload.targetAudience = audience.trim().slice(0, 120);

    await updateDoc(doc(db, 'subscriptionPlans', planId), payload);
    await createAuditLog(actor, {
      action: 'UPDATE_SUBSCRIPTION_PLAN',
      targetCollection: 'subscriptionPlans',
      targetId: planId,
      summary: `Updated subscription plan "${String(payload.name)}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `subscriptionPlans/${planId}`);
  }
}

export async function deleteSubscriptionPlan(
  planId: string,
  planName: string,
  actor: UserProfile
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'subscriptionPlans', planId));
    await createAuditLog(actor, {
      action: 'DELETE_SUBSCRIPTION_PLAN',
      targetCollection: 'subscriptionPlans',
      targetId: planId,
      summary: `Deleted subscription plan "${planName}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `subscriptionPlans/${planId}`);
  }
}

// =========================================================================
// SUBSCRIPTIONS & VERIFIED PAYMENTS
// =========================================================================

export async function listSubscriptions(organizationId?: string): Promise<Subscription[]> {
  try {
    const q = organizationId
      ? query(collection(db, 'subscriptions'), where('organizationId', '==', organizationId))
      : collection(db, 'subscriptions');
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Subscription);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'subscriptions');
  }
}

export async function listPayments(organizationId?: string): Promise<PaymentRecord[]> {
  try {
    const q = organizationId
      ? query(collection(db, 'payments'), where('organizationId', '==', organizationId))
      : collection(db, 'payments');
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as PaymentRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'payments');
  }
}

export async function createPaymentRecord(
  input: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>,
  actor: UserProfile
): Promise<PaymentRecord> {
  const id = generateSafeId('pay');
  const payload: Record<string, unknown> = {
    id,
    organizationId: input.organizationId,
    organizationName: input.organizationName.trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX),
    planId: input.planId,
    planName: input.planName.trim().slice(0, 100),
    amount: Number(input.amount),
    currency: input.currency.trim().slice(0, 10),
    billingCycle: input.billingCycle,
    referenceCode: input.referenceCode.trim().slice(0, 100),
    verificationStatus: input.verificationStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (input.verifiedBy) payload.verifiedBy = input.verifiedBy;
  if (input.notes) payload.notes = input.notes.trim().slice(0, 300);

  try {
    await setDoc(doc(db, 'payments', id), payload);
    await createAuditLog(actor, {
      organizationId: input.organizationId,
      action: 'CREATE_PAYMENT_RECORD',
      targetCollection: 'payments',
      targetId: id,
      summary: `Logged payment reference ${payload.referenceCode} (${payload.verificationStatus})`,
    });
    return { ...(payload as unknown as PaymentRecord), id };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `payments/${id}`);
  }
}

export async function verifyPaymentAndActivateSubscription(
  paymentId: string,
  newStatus: 'Verified' | 'Rejected',
  actor: UserProfile
): Promise<void> {
  try {
    const snap = await getDoc(doc(db, 'payments', paymentId));
    if (!snap.exists()) throw new Error('Payment record not found');
    const cur = snap.data() as PaymentRecord;

    await updateDoc(doc(db, 'payments', paymentId), {
      verificationStatus: newStatus,
      verifiedBy: actor.email,
      updatedAt: serverTimestamp(),
    });

    if (newStatus === 'Verified') {
      const orgSnap = await getDoc(doc(db, 'organizations', cur.organizationId));
      if (orgSnap.exists()) {
        const start = new Date();
        const expiry = new Date(start);
        if (cur.billingCycle === 'monthly') expiry.setMonth(expiry.getMonth() + 1);
        else if (cur.billingCycle === 'quarterly') expiry.setMonth(expiry.getMonth() + 3);
        else if (cur.billingCycle === 'half_yearly') expiry.setMonth(expiry.getMonth() + 6);
        else expiry.setFullYear(expiry.getFullYear() + 1);

        const startDate = start.toISOString().slice(0, 10);
        const expiryDate = expiry.toISOString().slice(0, 10);

        await updateDoc(doc(db, 'organizations', cur.organizationId), {
          subscriptionPlanId: cur.planId,
          subscriptionPlanName: cur.planName,
          subscriptionStatus: 'Active',
          subscriptionStartDate: startDate,
          subscriptionExpiryDate: expiryDate,
          updatedAt: serverTimestamp(),
        });

        const subId = generateSafeId('sub');
        await setDoc(doc(db, 'subscriptions', subId), {
          id: subId,
          organizationId: cur.organizationId,
          organizationName: cur.organizationName,
          planId: cur.planId,
          planName: cur.planName,
          billingCycle: cur.billingCycle,
          status: 'Active',
          startDate,
          expiryDate,
          verifiedBy: actor.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await createAuditLog(actor, {
      organizationId: cur.organizationId,
      action: newStatus === 'Verified' ? 'VERIFY_PAYMENT_ACTIVATE' : 'REJECT_PAYMENT',
      targetCollection: 'payments',
      targetId: paymentId,
      summary: `${newStatus} payment reference ${cur.referenceCode} for ${cur.organizationName}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `payments/${paymentId}`);
  }
}

// =========================================================================
// CONTACT MESSAGES (Public Form Submission)
// =========================================================================

export async function submitContactMessage(
  input: Omit<ContactMessage, 'id' | 'status' | 'createdAt'>
): Promise<void> {
  const id = generateSafeId('msg');
  const payload: Record<string, unknown> = {
    id,
    name: input.name.trim().slice(0, FIELD_LIMITS.NAME_MAX),
    email: input.email.trim().toLowerCase().slice(0, FIELD_LIMITS.EMAIL_MAX),
    phone: input.phone.trim().slice(0, FIELD_LIMITS.PHONE_MAX),
    subject: input.subject.trim().slice(0, 160),
    message: input.message.trim().slice(0, FIELD_LIMITS.MESSAGE_MAX),
    status: 'new',
    createdAt: serverTimestamp(),
  };
  if (input.companyName) {
    payload.companyName = input.companyName.trim().slice(0, FIELD_LIMITS.ORG_NAME_MAX);
  }
  try {
    await setDoc(doc(db, 'contactMessages', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `contactMessages/${id}`);
  }
}

export async function listContactMessages(): Promise<ContactMessage[]> {
  try {
    const snap = await getDocs(collection(db, 'contactMessages'));
    return snap.docs.map((d) => d.data() as ContactMessage);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'contactMessages');
  }
}
