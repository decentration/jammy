  export interface Ticket {
    entryIndex: number;
    proofOfValidity: Uint8Array; // based on 6.7 of the spec (73)
  }

  export interface TicketAccumulator { // based on 6.7 of the spec (74, 79)
    active: boolean; // true if m' < Y, false otherwise
    tickets: Ticket[];
    newTickets?: NewTicket[];
  }

  export interface NewTicket { // based on 6.7 of the spec (75)
    identity: Uint8Array;
    entryIndex: number;
  }

  export interface ExtrinsicTickets {
    tickets: Ticket[];
    ticketAccumulator?: TicketAccumulator; 
  }

  export interface Judgement {
    reportHash: Uint8Array; 
  }
  
  export interface Preimage {
    data: Uint8Array;
  }
  
  export interface Availability {
    assurance: Uint8Array;
  }
  
  export interface Report {
    report: Uint8Array; 
  }

