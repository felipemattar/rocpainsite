// Camada de dados: todo acesso ao Firebase passa por aqui.
// Para trocar de banco no futuro, só este arquivo precisa mudar.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch, query, where }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './config.js';

const app = initializeApp(firebaseConfig);
const fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const auth = getAuth(app);

let onWriteError = e => console.error(e);
export const setWriteErrorHandler = fn => { onWriteError = fn; };

// ---------- autenticação ----------
export const onUser = cb => onAuthStateChanged(auth, cb);
export async function signIn() {
  const p = new GoogleAuthProvider();
  try { await signInWithPopup(auth, p); }
  catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) return signInWithRedirect(auth, p);
    if (['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) return;
    throw e;
  }
}
export const redirectResult = () => getRedirectResult(auth);
export const signOutUser = () => signOut(auth);

// ---------- leitura ----------
// listen('items', cb) ou listen('projects', cb, {where:['team','array-contains', email]})
// cb recebe um Map id → dados. Retorna a função para parar de ouvir.
export function listen(path, cb, opts = {}, onErr) {
  let ref = collection(fs, path);
  if (opts.where) ref = query(ref, where(...opts.where));
  return onSnapshot(ref, snap => {
    const m = new Map(); snap.docs.forEach(d => m.set(d.id, d.data())); cb(m);
  }, err => onErr ? onErr(err) : console.error(err));
}

// ---------- escrita ----------
// As escritas não esperam o servidor: com a cópia local elas aparecem na hora
// (inclusive sem internet) e sincronizam depois. Erros vão para o handler.
export function save(path, data) { setDoc(doc(fs, path), data).catch(onWriteError); }
export function merge(path, data) { setDoc(doc(fs, path), data, { merge: true }).catch(onWriteError); }
export function remove(path) { deleteDoc(doc(fs, path)).catch(onWriteError); }
export const newId = col => doc(collection(fs, col)).id;
export async function batchSet(entries) { // [[path, data], ...]
  for (let i = 0; i < entries.length; i += 400) {
    const b = writeBatch(fs);
    entries.slice(i, i + 400).forEach(([p, d]) => b.set(doc(fs, p), d));
    await b.commit();
  }
}
