"""add_detection_zones_and_track_id

Revision ID: 4d9f512c3b0a
Revises: 3c8e401b2a9f
Create Date: 2026-08-20 02:00:00.000000+00:00
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '4d9f512c3b0a'
down_revision: Union[str, None] = '3c8e401b2a9f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add track_id to events table
    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.add_column(sa.Column('track_id', sa.Integer(), nullable=True))
        batch_op.create_index('ix_events_track_id', ['track_id'], unique=False)

    # 2. Create detection_zones table
    op.create_table(
        'detection_zones',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('camera_id', sa.Uuid(), nullable=False),
        sa.Column('tenant_id', sa.Uuid(), nullable=False),
        sa.Column('site_id', sa.Uuid(), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('zone_type', sa.String(length=50), nullable=False),
        sa.Column('polygon_points', sa.JSON(), nullable=False),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('alert_on_entry', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('alert_on_loiter', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('loiter_seconds', sa.Integer(), nullable=False, server_default='30'),
        sa.Column('severity', sa.String(length=20), nullable=False, server_default='medium'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['camera_id'], ['cameras.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['site_id'], ['sites.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_detection_zones_camera_id'), 'detection_zones', ['camera_id'], unique=False)
    op.create_index(op.f('ix_detection_zones_tenant_id'), 'detection_zones', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_detection_zones_tenant_id'), table_name='detection_zones')
    op.drop_index(op.f('ix_detection_zones_camera_id'), table_name='detection_zones')
    op.drop_table('detection_zones')

    with op.batch_alter_table('events', schema=None) as batch_op:
        batch_op.drop_index('ix_events_track_id')
        batch_op.drop_column('track_id')
