import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "../firebase/firebaseConfig";
import { LEGAL_DOCUMENTS_VERSION } from "../domain/legalDocuments.mjs";

const functions = getFirebaseFunctions("us-central1");

export async function acceptLegalTerms() {
  const callable = httpsCallable(functions, "acceptLegalTerms");
  const response = await callable({ version: LEGAL_DOCUMENTS_VERSION });
  return response.data;
}
