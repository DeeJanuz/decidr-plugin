(function() {
  'use strict';

  var people = [
    { id: 'u-daenon', name: 'Daenon Janis', email: 'daenon@example.com' },
    { id: 'u-alex', name: 'Alex Rivera', email: 'alex@example.com' },
    { id: 'u-mira', name: 'Mira Chen', email: 'mira@example.com' },
    { id: 'u-sam', name: 'Sam Patel', email: 'sam@example.com' }
  ];

  var initiatives = [
    {
      id: 'init-decidr-dev',
      name: 'DecidR development',
      status: 'ACTIVE',
      createdAt: '2026-06-02T15:00:00.000Z',
      createdById: 'u-daenon'
    }
  ];

  var projects = [
    {
      id: 'project-timeline-ux',
      name: 'Timeline UX and visibility',
      initiativeId: 'init-decidr-dev',
      status: 'IN_PROGRESS',
      ownerId: 'u-daenon',
      createdById: 'u-daenon',
      createdAt: '2026-06-03T14:30:00.000Z'
    },
    {
      id: 'project-window-api',
      name: 'Windowed timeline API',
      initiativeId: 'init-decidr-dev',
      status: 'STAGED',
      ownerId: 'u-alex',
      createdById: 'u-daenon',
      createdAt: '2026-06-03T16:10:00.000Z'
    },
    {
      id: 'project-stage-tools',
      name: 'Stage timestamp correction tools',
      initiativeId: 'init-decidr-dev',
      status: 'IMPLEMENTED',
      ownerId: 'u-mira',
      createdById: 'u-daenon',
      createdAt: '2026-06-03T18:25:00.000Z'
    },
    {
      id: 'project-plugin-release',
      name: 'Plugin release and MCPViews install',
      initiativeId: 'init-decidr-dev',
      status: 'ACTIVE',
      ownerId: 'u-sam',
      createdById: 'u-daenon',
      createdAt: '2026-06-04T13:20:00.000Z'
    }
  ];

  var decisions = [
    {
      id: 'decision-accountability',
      title: 'Add accountability signals to the DecidR timeline renderer',
      entityType: 'PROJECT',
      entityId: 'project-timeline-ux',
      status: 'IMPLEMENTED',
      createdAt: '2026-06-03T19:12:00.000Z',
      decidedAt: '2026-06-05T15:12:00.000Z',
      createdById: 'u-daenon'
    },
    {
      id: 'decision-project-grouping',
      title: 'Group timeline work by project inside initiative lanes',
      entityType: 'PROJECT',
      entityId: 'project-timeline-ux',
      status: 'STAGED',
      createdAt: '2026-06-05T15:22:00.000Z',
      updatedAt: '2026-06-05T21:40:00.000Z',
      createdById: 'u-daenon'
    },
    {
      id: 'decision-window-loading',
      title: 'Add windowed lazy loading for scalable DecidR timeline views',
      entityType: 'PROJECT',
      entityId: 'project-window-api',
      status: 'IMPLEMENTED',
      createdAt: '2026-06-05T14:41:00.000Z',
      decidedAt: '2026-06-05T21:17:00.000Z',
      createdById: 'u-alex'
    },
    {
      id: 'decision-stage-time',
      title: 'Add owner-gated timeline stage timestamp correction tools',
      entityType: 'PROJECT',
      entityId: 'project-stage-tools',
      status: 'IMPLEMENTED',
      createdAt: '2026-06-04T17:26:00.000Z',
      decidedAt: '2026-06-05T19:45:00.000Z',
      createdById: 'u-mira'
    },
    {
      id: 'decision-plugin-rc8',
      title: 'Release DecidR plugin 0.1.33-rc.8',
      entityType: 'PROJECT',
      entityId: 'project-plugin-release',
      status: 'IMPLEMENTED',
      createdAt: '2026-06-05T20:58:00.000Z',
      decidedAt: '2026-06-05T21:16:00.000Z',
      createdById: 'u-sam'
    },
    {
      id: 'decision-open-span',
      title: 'Keep open decision bars visible through the current date',
      entityType: 'PROJECT',
      entityId: 'project-timeline-ux',
      status: 'IN_PROGRESS',
      createdAt: '2026-06-04T20:05:00.000Z',
      updatedAt: '2026-06-05T18:35:00.000Z',
      createdById: 'u-daenon'
    },
    {
      id: 'decision-catch-up',
      title: 'Capture shipped timeline badge polish after implementation',
      description: 'Small UI polish was already implemented; this catch-up decision records why it happened.',
      kind: 'CATCH_UP',
      entityType: 'PROJECT',
      entityId: 'project-timeline-ux',
      status: 'IMPLEMENTED',
      createdAt: '2026-06-05T22:30:00.000Z',
      decidedAt: '2026-06-04T18:20:00.000Z',
      createdById: 'u-daenon'
    }
  ];

  var tasks = [
    {
      id: 'task-visual-review',
      title: 'Review grouped project bands with inline browser comments',
      projectId: 'project-timeline-ux',
      status: 'TODO',
      dueDate: '2026-06-06T18:00:00.000Z',
      createdAt: '2026-06-05T21:28:00.000Z',
      assigneeId: 'u-daenon',
      createdById: 'u-daenon'
    },
    {
      id: 'task-dense-window',
      title: 'Stress dense activity in a narrow two-hour period',
      projectId: 'project-timeline-ux',
      status: 'IN_PROGRESS',
      dueDate: '2026-06-05T23:30:00.000Z',
      createdAt: '2026-06-05T17:52:00.000Z',
      assigneeId: 'u-mira',
      createdById: 'u-daenon'
    },
    {
      id: 'task-api-cursor',
      title: 'Validate cursor paging on the timeline window endpoint',
      projectId: 'project-window-api',
      status: 'DONE',
      dueDate: '2026-06-05T20:30:00.000Z',
      createdAt: '2026-06-05T16:40:00.000Z',
      assigneeId: 'u-alex',
      createdById: 'u-daenon'
    },
    {
      id: 'task-release-notes',
      title: 'Prepare release notes for project-grouped timeline mock',
      projectId: 'project-plugin-release',
      status: 'TODO',
      dueDate: '2026-06-06T20:00:00.000Z',
      createdAt: '2026-06-05T21:06:00.000Z',
      assigneeId: 'u-sam',
      createdById: 'u-daenon'
    },
    {
      id: 'task-unassigned',
      title: 'Decide whether project headers need collapse controls',
      projectId: 'project-timeline-ux',
      status: 'TODO',
      dueDate: '2026-06-07T16:00:00.000Z',
      createdAt: '2026-06-05T21:31:00.000Z',
      createdById: 'u-daenon'
    }
  ];

  function statusEvent(id, decisionId, at, from, to, actorId, title, extraMetadata) {
    var metadata = {
      decisionTitle: title,
      from: from,
      to: to
    };
    if (extraMetadata) {
      for (var key in extraMetadata) {
        if (Object.prototype.hasOwnProperty.call(extraMetadata, key)) {
          metadata[key] = extraMetadata[key];
        }
      }
    }
    return {
      id: id,
      decisionId: decisionId,
      action: 'STATUS_CHANGED',
      occurredAt: at,
      createdAt: at,
      actorId: actorId,
      actor: people.filter(function(p) { return p.id === actorId; })[0],
      metadata: metadata
    };
  }

  function taskEvent(id, taskId, at, actorId, title, action) {
    return {
      id: id,
      taskId: taskId,
      action: action || 'UPDATED',
      occurredAt: at,
      createdAt: at,
      actorId: actorId,
      actor: people.filter(function(p) { return p.id === actorId; })[0],
      metadata: {
        taskTitle: title
      }
    };
  }

  var timelineEvents = [
    statusEvent('evt-accountability-proposed', 'decision-accountability', '2026-06-03T19:12:00.000Z', 'DRAFT', 'PROPOSED', 'u-daenon', decisions[0].title),
    statusEvent('evt-accountability-staged', 'decision-accountability', '2026-06-05T14:52:00.000Z', 'IN_PROGRESS', 'STAGED', 'u-daenon', decisions[0].title),
    statusEvent('evt-accountability-implemented', 'decision-accountability', '2026-06-05T15:12:00.000Z', 'STAGED', 'IMPLEMENTED', 'u-daenon', decisions[0].title),
    statusEvent('evt-project-grouping-proposed', 'decision-project-grouping', '2026-06-05T15:22:00.000Z', 'DRAFT', 'PROPOSED', 'u-daenon', decisions[1].title),
    statusEvent('evt-project-grouping-staged', 'decision-project-grouping', '2026-06-05T21:40:00.000Z', 'IN_PROGRESS', 'STAGED', 'u-daenon', decisions[1].title),
    statusEvent('evt-window-proposed', 'decision-window-loading', '2026-06-05T14:41:00.000Z', 'DRAFT', 'PROPOSED', 'u-alex', decisions[2].title),
    statusEvent('evt-window-staged', 'decision-window-loading', '2026-06-05T21:05:00.000Z', 'IN_PROGRESS', 'STAGED', 'u-alex', decisions[2].title),
    statusEvent('evt-window-implemented', 'decision-window-loading', '2026-06-05T21:17:00.000Z', 'STAGED', 'IMPLEMENTED', 'u-daenon', decisions[2].title),
    statusEvent('evt-stage-proposed', 'decision-stage-time', '2026-06-04T17:26:00.000Z', 'DRAFT', 'PROPOSED', 'u-mira', decisions[3].title),
    statusEvent('evt-stage-implemented', 'decision-stage-time', '2026-06-05T19:45:00.000Z', 'STAGED', 'IMPLEMENTED', 'u-mira', decisions[3].title),
    statusEvent('evt-rc8-proposed', 'decision-plugin-rc8', '2026-06-05T20:58:00.000Z', 'DRAFT', 'PROPOSED', 'u-sam', decisions[4].title),
    statusEvent('evt-rc8-implemented', 'decision-plugin-rc8', '2026-06-05T21:16:00.000Z', 'STAGED', 'IMPLEMENTED', 'u-sam', decisions[4].title),
    statusEvent('evt-open-progress', 'decision-open-span', '2026-06-05T18:35:00.000Z', 'PROPOSED', 'IN_PROGRESS', 'u-daenon', decisions[5].title),
    statusEvent('evt-catch-up-implemented', 'decision-catch-up', '2026-06-04T18:20:00.000Z', 'DRAFT', 'IMPLEMENTED', 'u-daenon', decisions[6].title, { catchUp: true, kind: 'CATCH_UP' }),
    taskEvent('evt-task-review-created', 'task-visual-review', '2026-06-05T21:28:00.000Z', 'u-daenon', tasks[0].title, 'CREATED'),
    taskEvent('evt-task-dense-one', 'task-dense-window', '2026-06-05T17:52:00.000Z', 'u-mira', tasks[1].title, 'CREATED'),
    taskEvent('evt-task-dense-two', 'task-dense-window', '2026-06-05T18:06:00.000Z', 'u-mira', 'Dense row spacing adjusted', 'UPDATED'),
    taskEvent('evt-task-dense-three', 'task-dense-window', '2026-06-05T18:18:00.000Z', 'u-daenon', 'Project grouping reviewed', 'COMMENTED'),
    taskEvent('evt-task-api-done', 'task-api-cursor', '2026-06-05T20:20:00.000Z', 'u-alex', tasks[2].title, 'STATUS_CHANGED'),
    taskEvent('evt-task-release-notes', 'task-release-notes', '2026-06-05T21:06:00.000Z', 'u-sam', tasks[3].title, 'CREATED'),
    taskEvent('evt-task-unassigned', 'task-unassigned', '2026-06-05T21:31:00.000Z', 'u-daenon', tasks[4].title, 'CREATED')
  ];

  window.__decidrTimelineMockPayload = {
    range: {
      from: '2026-06-01T00:00:00.000Z',
      to: '2026-06-08T23:59:59.999Z',
      bufferDays: 7
    },
    initiatives: initiatives,
    projects: projects,
    decisions: decisions,
    tasks: tasks,
    bridges: [],
    issues: [],
    prs: [],
    people: people,
    timelineEvents: timelineEvents,
    totals: {
      initiatives: initiatives.length,
      projects: projects.length,
      decisions: decisions.length,
      tasks: tasks.length,
      timelineEvents: timelineEvents.length
    }
  };
})();
