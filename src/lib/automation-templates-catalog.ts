/**
 * Libreria template centralizzata (email + webhook) per regole automazione.
 * Placeholder supportati come nel motore: {{trigger}}, {{clientName}}, {{url}}, …
 */
export type AutomationActionTemplate = {
  id: string;
  title: string;
  emailSubjectTemplate: string;
  emailBodyTemplate: string;
  webhookPayloadTemplate: string;
};

export const AUTOMATION_ACTION_TEMPLATES: AutomationActionTemplate[] = [
  {
    id: "ops-minimal",
    title: "Ops — notifica breve",
    emailSubjectTemplate: "[Onizuka] {{trigger}} · {{label}}",
    emailBodyTemplate:
      "Evento: {{trigger}}\nDettaglio: {{label}}\nCliente: {{clientName}}\nLink: {{url}}\nOra: {{createdAt}}",
    webhookPayloadTemplate: '{"event":"{{trigger}}","label":"{{label}}","clientId":"{{clientId}}","url":"{{url}}"}',
  },
  {
    id: "crm-lead",
    title: "CRM — nuovo lead",
    emailSubjectTemplate: "Nuovo lead · {{subject}}",
    emailBodyTemplate:
      "Lead: {{subject}}\nContatto: {{contactName}}\nEmail: {{email}}\nTelefono: {{phone}}\nFonte: {{source}}\nURL CRM: {{url}}",
    webhookPayloadTemplate:
      '{"type":"lead","trigger":"{{trigger}}","title":"{{subject}}","email":"{{email}}","source":"{{source}}"}',
  },
  {
    id: "ticket-alert",
    title: "Ticket — apertura",
    emailSubjectTemplate: "Ticket cliente · {{subject}}",
    emailBodyTemplate:
      "Ticket: {{subject}}\nCliente: {{clientName}}\nPriorità: {{priority}}\nApri: {{url}}",
    webhookPayloadTemplate: '{"type":"ticket","subject":"{{subject}}","clientId":"{{clientId}}","priority":"{{priority}}"}',
  },
  {
    id: "finance-income",
    title: "Finance — entrata",
    emailSubjectTemplate: "Entrata registrata · €{{amountEur}}",
    emailBodyTemplate:
      "Importo: {{amountEur}} EUR\nVoce: {{label}}\nCliente: {{clientName}}\nDettaglio: {{url}}",
    webhookPayloadTemplate: '{"type":"finance_income","amountEur":"{{amountEur}}","label":"{{label}}","clientId":"{{clientId}}"}',
  },
];
