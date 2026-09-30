const fs = require('fs');

let userMgmt = fs.readFileSync('src/components/UserManagement.tsx', 'utf8');

userMgmt = userMgmt.replace(
  "if (confirm('Möchten Sie wirklich ALLE aktiven Benutzer (inkl. Admins) abmelden? Alle laufenden Sitzungen werden beendet.')) {\n                      deactivateAllUsers(true);\n                    }",
  "showConfirmModal({ title: 'Alle abmelden', message: 'Möchten Sie wirklich ALLE aktiven Benutzer (inkl. Admins) abmelden? Alle laufenden Sitzungen werden beendet.', confirmLabel: 'Alle abmelden', isDanger: true, onConfirm: () => deactivateAllUsers(true) });"
);

userMgmt = userMgmt.replace(
  "if (\n                          confirm(\n                            `Möchten Sie \"${activeUser.name}\" (${activeUser.callSign}) wirklich aus dem aktuellen Einsatz abmelden?\\n\\nDer Account und alle Zugangsdaten bleiben erhalten.`\n                          )\n                        ) {\n                          removeUserFromOperation(activeUser.id);\n                          onClose();\n                        }",
  "showConfirmModal({ title: 'Benutzer abmelden', message: `Möchten Sie \"${activeUser.name}\" (${activeUser.callSign}) wirklich aus dem aktuellen Einsatz abmelden?\\n\\nDer Account und alle Zugangsdaten bleiben erhalten.`, confirmLabel: 'Abmelden', isDanger: true, onConfirm: () => { removeUserFromOperation(activeUser.id); onClose(); } });"
);

fs.writeFileSync('src/components/UserManagement.tsx', userMgmt);

let responderList = fs.readFileSync('src/components/ResponderList.tsx', 'utf8');
responderList = responderList.replace(
  "if (confirm(`${user.name} (${user.callSign}) wirklich aus dem aktuellen Einsatz abmelden?`)) {\n                                  removeUserFromOperation(user.id);\n                                }",
  "showConfirmModal({ title: 'Benutzer abmelden', message: `${user.name} (${user.callSign}) wirklich aus dem aktuellen Einsatz abmelden?`, confirmLabel: 'Abmelden', isDanger: true, onConfirm: () => removeUserFromOperation(user.id) });"
);
fs.writeFileSync('src/components/ResponderList.tsx', responderList);

console.log("Confirm patched");
