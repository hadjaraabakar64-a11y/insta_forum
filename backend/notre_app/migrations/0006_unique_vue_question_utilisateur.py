from django.db import migrations, models
from django.db.models import Min


def supprimer_vues_dupliquees(apps, schema_editor):
    Vue = apps.get_model('notre_app', 'vue')
    premieres_vues = (
        Vue.objects.using(schema_editor.connection.alias)
        .order_by()
        .values('question_id', 'utilisateur_id')
        .annotate(premiere_id=Min('pk'))
        .values('premiere_id')
    )
    Vue.objects.using(schema_editor.connection.alias).exclude(
        pk__in=premieres_vues
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('notre_app', '0005_vue'),
    ]

    operations = [
        migrations.RunPython(
            supprimer_vues_dupliquees,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name='vue',
            constraint=models.UniqueConstraint(
                fields=('question', 'utilisateur'),
                name='unique_vue_question_utilisateur',
            ),
        ),
    ]
