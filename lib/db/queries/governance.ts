// lib/db/queries/governance.ts
import { executeQuery } from '@/lib/db';
import { 
  Decision, 
  DecisionStatus, 
  DecisionPriority, 
  Vote, 
  VoteInput, 
  DecisionCreateInput,
  RecentDecision,
  BoardStats
} from '@/types/governance';

export const GovernanceQueries = {
  async createDecision(data: DecisionCreateInput): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `INSERT INTO decisions (
        project_id, title, description, amount, priority,
        justification, requester_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED')
      RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [
        data.projectId,
        data.title,
        data.description || null,
        data.amount || null,
        data.priority,
        data.justification || null,
        data.requesterId
      ]
    );
    return rows[0];
  },

  async findById(id: string): Promise<Decision | null> {
    const rows = await executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName",
        p.name as "projectName",
        (
          SELECT json_agg(
            json_build_object(
              'id', v.id,
              'vote', v.vote,
              'comments', v.comments,
              'boardMemberId', v.board_member_id,
              'boardMemberName', u2.name,
              'createdAt', v.created_at
            )
          )
          FROM votes v
          LEFT JOIN users u2 ON v.board_member_id = u2.id
          WHERE v.decision_id = d.id
        ) as votes
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // ✅ ADD THIS METHOD - Find decisions by project
  async findByProject(projectId: string): Promise<Decision[]> {
    return executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName"
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      WHERE d.project_id::text = $1::text
      ORDER BY d.priority DESC, d.created_at DESC`,
      [projectId]
    );
  },

  // ✅ ADD THIS METHOD - Find decisions by requester
  async findByRequester(requesterId: string): Promise<Decision[]> {
    return executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName",
        p.name as "projectName"
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.requester_id = $1
      ORDER BY d.created_at DESC`,
      [requesterId]
    );
  },

  async getPendingDecisions(): Promise<Decision[]> {
    return executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName",
        p.name as "projectName",
        (
          SELECT COUNT(*) FROM votes v WHERE v.decision_id = d.id
        ) as "voteCount"
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.status IN ('SUBMITTED', 'UNDER_REVIEW', 'ESCALATED_TO_BOARD', 'BOARD_VOTING')
      ORDER BY 
        CASE d.priority 
          WHEN 'CRITICAL' THEN 1
          WHEN 'HIGH' THEN 2
          WHEN 'MEDIUM' THEN 3
          WHEN 'LOW' THEN 4
        END ASC,
        d.created_at ASC`
    );
  },

  async updateStatus(id: string, status: DecisionStatus, comments?: string): Promise<Decision> {
    let query = `
      UPDATE decisions 
      SET status = $1, updated_at = NOW()
    `;
    const params: any[] = [status, id];
    let paramIndex = 3;

    if (comments) {
      query += `, ceo_comments = COALESCE(ceo_comments || '', '') || $${paramIndex}`;
      params.push(comments);
      paramIndex++;
    }

    query += ` WHERE id = $2
      RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    const rows = await executeQuery<Decision>(query, params);
    return rows[0];
  },

  async escalateToBoard(id: string, ceoComments: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'ESCALATED_TO_BOARD', 
           ceo_comments = COALESCE(ceo_comments || '', '') || $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [ceoComments, id]
    );
    return rows[0];
  },

  async startBoardVoting(id: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'BOARD_VOTING', updated_at = NOW()
       WHERE id = $1
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [id]
    );
    return rows[0];
  },

  async castVote(data: VoteInput): Promise<Vote> {
    const existing = await executeQuery<Vote>(
      `SELECT * FROM votes WHERE decision_id = $1 AND board_member_id = $2`,
      [data.decisionId, data.boardMemberId]
    );

    if (existing.length > 0) {
      const rows = await executeQuery<Vote>(
        `UPDATE votes 
         SET vote = $1, comments = $2, created_at = NOW()
         WHERE decision_id = $3 AND board_member_id = $4
         RETURNING 
          id, decision_id as "decisionId",
          board_member_id as "boardMemberId",
          vote, comments,
          created_at as "createdAt"`,
        [data.vote, data.comments || null, data.decisionId, data.boardMemberId]
      );
      return rows[0];
    }

    const rows = await executeQuery<Vote>(
      `INSERT INTO votes (decision_id, board_member_id, vote, comments)
       VALUES ($1, $2, $3, $4)
       RETURNING 
        id, decision_id as "decisionId",
        board_member_id as "boardMemberId",
        vote, comments,
        created_at as "createdAt"`,
      [data.decisionId, data.boardMemberId, data.vote, data.comments || null]
    );
    return rows[0];
  },

  async getVoteResults(decisionId: string): Promise<any> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as "totalVotes",
        COUNT(CASE WHEN vote = 'APPROVE' THEN 1 END) as approves,
        COUNT(CASE WHEN vote = 'REJECT' THEN 1 END) as rejects,
        COUNT(CASE WHEN vote = 'ABSTAIN' THEN 1 END) as abstains
      FROM votes
      WHERE decision_id = $1`,
      [decisionId]
    );
    return rows[0] || {};
  },

  async getBoardStats(): Promise<BoardStats> {
    const rows = await executeQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status IN ('SUBMITTED', 'UNDER_REVIEW', 'ESCALATED_TO_BOARD', 'BOARD_VOTING') THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected,
        COALESCE(SUM(amount), 0) as "totalValue"
      FROM decisions`
    );
    return rows[0] || { total: 0, pending: 0, approved: 0, rejected: 0, totalValue: 0 };
  },

  async resolveDecision(id: string, resolution: string, userId: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'BOARD_RESOLVED', 
           board_resolution = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [resolution, id]
    );

    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'RESOLVE_DECISION',
        'DECISION',
        id,
        JSON.stringify({ resolution })
      ]
    );

    return rows[0];
  },

  async deleteDecision(id: string): Promise<void> {
    await executeQuery(
      `DELETE FROM votes WHERE decision_id = $1`,
      [id]
    );
    
    await executeQuery(
      `DELETE FROM decisions WHERE id = $1`,
      [id]
    );
  },

  // ✅ ADD THIS METHOD - Get recent decisions
  async getRecentDecisions(limit: number = 10): Promise<RecentDecision[]> {
    return executeQuery(
      `SELECT 
        d.id,
        d.title,
        d.status,
        d.created_at,
        p.name as "projectName",
        u.name as "requesterName"
      FROM decisions d
      LEFT JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON d.requester_id = u.id
      ORDER BY d.created_at DESC
      LIMIT $1`,
      [limit]
    );
  },

  // ✅ ADD THIS METHOD - Get decisions by status
  async getDecisionsByStatus(status: DecisionStatus): Promise<Decision[]> {
    return executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName",
        p.name as "projectName"
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.status = $1
      ORDER BY d.created_at DESC`,
      [status]
    );
  },

  // ✅ ADD THIS METHOD - Get decisions by requester
  async getDecisionsByRequester(requesterId: string): Promise<Decision[]> {
    return executeQuery<Decision>(
      `SELECT 
        d.*,
        u.name as "requesterName",
        p.name as "projectName"
      FROM decisions d
      LEFT JOIN users u ON d.requester_id = u.id
      LEFT JOIN projects p ON d.project_id = p.id
      WHERE d.requester_id = $1
      ORDER BY d.created_at DESC`,
      [requesterId]
    );
  },

  // ✅ ADD THIS METHOD - Get decision stats
  async getDecisionStats(): Promise<any> {
    const rows = await executeQuery(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'UNDER_REVIEW' THEN 1 END) as "underReview",
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'ESCALATED_TO_BOARD' THEN 1 END) as "escalatedToBoard",
        COUNT(CASE WHEN status = 'BOARD_VOTING' THEN 1 END) as "boardVoting",
        COUNT(CASE WHEN status = 'BOARD_RESOLVED' THEN 1 END) as "boardResolved",
        COALESCE(SUM(amount), 0) as "totalValue",
        COALESCE(AVG(amount), 0) as "avgValue"
      FROM decisions
    `);
    return rows[0] || {};
  },

  // ✅ ADD THIS METHOD - Approve decision
  async approveDecision(id: string, userId: string, comments?: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'APPROVED', 
           ceo_comments = COALESCE(ceo_comments || '', '') || $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [id, userId, comments ? '\n' + comments : '']
    );

    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'APPROVE_DECISION',
        'DECISION',
        id,
        JSON.stringify({ status: 'APPROVED', comments }),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    return rows[0];
  },

  // ✅ ADD THIS METHOD - Reject decision
  async rejectDecision(id: string, userId: string, comments?: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'REJECTED', 
           ceo_comments = COALESCE(ceo_comments || '', '') || $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [id, userId, comments ? '\n' + comments : '']
    );

    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'REJECT_DECISION',
        'DECISION',
        id,
        JSON.stringify({ status: 'REJECTED', comments }),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    return rows[0];
  },

  // ✅ ADD THIS METHOD - Escalate decision to board
  async escalateDecisionToBoard(id: string, userId: string, comments?: string): Promise<Decision> {
    const rows = await executeQuery<Decision>(
      `UPDATE decisions 
       SET status = 'ESCALATED_TO_BOARD', 
           ceo_comments = COALESCE(ceo_comments || '', '') || $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING 
        id, project_id as "projectId", title, description,
        amount, priority, justification, requester_id as "requesterId",
        status, ceo_comments as "ceoComments",
        board_resolution as "boardResolution",
        created_at as "createdAt", updated_at as "updatedAt"`,
      [id, userId, comments ? '\n' + comments : '']
    );

    await executeQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, changes, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        userId,
        'ESCALATE_DECISION_TO_BOARD',
        'DECISION',
        id,
        JSON.stringify({ status: 'ESCALATED_TO_BOARD', comments }),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );

    return rows[0];
  }
};