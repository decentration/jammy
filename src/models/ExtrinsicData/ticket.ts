export interface Ticket {
    validatorId: string;
    signature: string;
   // TODO: add more here 
}

export const serializeTicket = (ticket: Ticket): string => JSON.stringify(ticket);

export const deserializeTicket = (data: string): Ticket => JSON.parse(data);